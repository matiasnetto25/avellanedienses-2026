-- =====================================================================
-- Punto 12 · Issue 01 · Modelo de datos de pedidos
--
-- Cada estadía (fila de solicitudes_mesa en estado 'vinculado') tiene a
-- lo sumo UN pedido, con sus ítems. Los puntos 13, 14 y del 16 en
-- adelante cambian estados sobre estas mismas dos tablas.
--
-- Sin RPC: el cliente (anónimo o registrado) crea el pedido con dos
-- insert directos (primero el pedido, después los ítems) y las políticas
-- RLS deciden qué se acepta:
--   - Solo se pide desde una estadía vinculada.
--   - El pedido nace en 'pendiente_confirmacion': no llega a cocina ni a
--     bar hasta que el mozo lo confirma (punto 14).
--   - Cada ítem guarda el precio de la carta al momento de pedir, y la
--     política exige que sea IGUAL a menu.precio: la app no puede
--     inventar precios. Lo mismo con el sector (cocina o bar).
--
-- El total y el tiempo estimado NO se guardan: los calcula
-- PedidosService a partir de los ítems (suma de precio_unitario por
-- cantidad y demora máxima de la carta). Así no se pueden desincronizar
-- ni falsear. La mesa y el cliente se leen con embedding a la estadía.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------
create table public.pedidos (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  -- La estadía. Un solo pedido por estadía: si el mozo lo rechaza
  -- (punto 13), el cliente edita el mismo en lugar de crear otro.
  -- Si se borra la solicitud, se borra su pedido.
  solicitud_id    uuid        not null references public.solicitudes_mesa(id) on delete cascade,
  estado          text        not null default 'pendiente_confirmacion',
  -- Lo completa el mozo al rechazar (punto 13).
  motivo_rechazo  text        null,

  constraint pedidos_solicitud_unica unique (solicitud_id),

  -- Check con nombre propio para poder ampliarlo en los puntos 16 en
  -- adelante:
  --   alter table public.pedidos drop constraint pedidos_estado_check;
  --   alter table public.pedidos add constraint pedidos_estado_check
  --     check (estado in (...lista anterior..., 'nuevo_estado'));
  constraint pedidos_estado_check
    check (estado in ('pendiente_confirmacion', 'rechazado', 'confirmado'))
);

create table public.pedido_items (
  id               uuid          primary key default gen_random_uuid(),
  pedido_id        uuid          not null references public.pedidos(id) on delete cascade,
  -- Sin cascade: los productos no se borran, se dan de baja (estado 'Off').
  menu_id          uuid          not null references public.menu(id),
  cantidad         int           not null,
  -- Congelado al pedir: si después cambia la carta, la cuenta (punto 21)
  -- no cambia.
  precio_unitario  numeric(12,2) not null,
  -- Sale de menu.tipo: 'bebida' va a bar; 'comida' y 'postre', a cocina.
  sector           text          not null,
  estado           text          not null default 'pendiente',

  -- El mismo producto no se repite: se sube la cantidad.
  constraint pedido_items_producto_unico unique (pedido_id, menu_id),
  constraint pedido_items_cantidad_check check (cantidad between 1 and 20),
  constraint pedido_items_precio_check check (precio_unitario > 0),
  constraint pedido_items_sector_check check (sector in ('cocina', 'bar')),
  constraint pedido_items_estado_check
    check (estado in ('pendiente', 'en_preparacion', 'listo'))
);

-- El índice único (pedido_id, menu_id) ya sirve para buscar por pedido_id.

-- ---------------------------------------------------------------------
-- Seguridad (RLS)
-- ---------------------------------------------------------------------
alter table public.pedidos enable row level security;
alter table public.pedido_items enable row level security;

-- Lectura: todos, igual que mensajes_mesa. La necesitan el cliente
-- anónimo (no tiene sesión, así que no se puede filtrar por usuario) y
-- Realtime para entregarle los cambios de estado. Se evaluó exponer solo
-- algunas columnas, pero ninguna es sensible: estado, motivo, productos
-- y precios, sin datos personales (el cliente se lee de su propia tabla).
create policy pedidos_select_todos
  on public.pedidos
  for select
  to anon, authenticated
  using (true);

create policy pedido_items_select_todos
  on public.pedido_items
  for select
  to anon, authenticated
  using (true);

-- Cliente: crea el pedido de una estadía vinculada, siempre en
-- 'pendiente_confirmacion' y sin motivo de rechazo. El segundo pedido de
-- la misma estadía lo frena pedidos_solicitud_unica (error 23505).
create policy pedidos_insert_cliente
  on public.pedidos
  for insert
  to anon, authenticated
  with check (
    pedidos.estado = 'pendiente_confirmacion'
    and pedidos.motivo_rechazo is null
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = pedidos.solicitud_id
        and s.estado = 'vinculado'
    )
  );

-- Cliente: agrega ítems solo a un pedido que todavía espera al mozo, con
-- un producto activo de la carta, su precio exacto y su sector.
create policy pedido_items_insert_cliente
  on public.pedido_items
  for insert
  to anon, authenticated
  with check (
    pedido_items.estado = 'pendiente'
    and exists (
      select 1
      from public.pedidos p
      where p.id = pedido_items.pedido_id
        and p.estado = 'pendiente_confirmacion'
    )
    and exists (
      select 1
      from public.menu m
      where m.id = pedido_items.menu_id
        and m.estado = 'On'
        and m.precio = pedido_items.precio_unitario
        and pedido_items.sector = case when m.tipo = 'bebida' then 'bar' else 'cocina' end
    )
  );

-- Vuelta atrás: el pedido y sus ítems son dos insert separados. Si los
-- ítems fallan (por ejemplo, un producto se dio de baja mientras el
-- cliente armaba el pedido), PedidosService borra el pedido que quedó
-- vacío. Sin esto, la estadía quedaría trabada con un pedido sin ítems
-- (pedidos_solicitud_unica no la deja crear otro). Solo se puede borrar
-- un pedido pendiente y SIN ítems.
create policy pedidos_delete_vacio
  on public.pedidos
  for delete
  to anon, authenticated
  using (
    pedidos.estado = 'pendiente_confirmacion'
    and not exists (
      select 1
      from public.pedido_items i
      where i.pedido_id = pedidos.id
    )
  );

-- Sin políticas de update: nadie cambia estados todavía. Los puntos 13
-- (rechazar y editar) y 14 (confirmar) agregan las suyas.

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.pedidos, public.pedido_items;
