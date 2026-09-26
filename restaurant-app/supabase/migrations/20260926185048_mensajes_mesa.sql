-- =====================================================================
-- Punto 11 · Issue 03 · Chat por estadía (consultas al mozo)
--
-- Cada estadía (fila de solicitudes_mesa en estado 'vinculado') tiene su
-- chat. Todos los mozos pueden ver y responder todas las conversaciones.
--
-- Sin RPC: los mensajes se escriben con insert directo y las políticas
-- RLS deciden quién puede. El número de mesa y el nombre del autor no se
-- guardan: la app los lee con un join (embedding de Supabase) a la
-- estadía, la mesa, el cliente y el empleado, así que no los puede falsear.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table public.mensajes_mesa (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  -- La estadía. Si se borra la solicitud, se borra su chat.
  solicitud_id  uuid        not null references public.solicitudes_mesa(id) on delete cascade,
  -- null = lo escribió el cliente de la estadía.
  empleado_id   int         null references public.empleados(id),
  texto         text        not null,

  constraint mensajes_mesa_texto_valido
    check (char_length(btrim(texto)) between 1 and 300)
);

create index mensajes_mesa_solicitud_created_at_idx
  on public.mensajes_mesa (solicitud_id, created_at);

-- ---------------------------------------------------------------------
-- Seguridad (RLS)
-- ---------------------------------------------------------------------
alter table public.mensajes_mesa enable row level security;

-- Lectura: todos (también la necesita Realtime para entregar los cambios).
create policy mensajes_mesa_select_todos
  on public.mensajes_mesa
  for select
  to anon, authenticated
  using (true);

-- Cliente (anónimo sin sesión o registrado con sesión): escribe sin
-- empleado_id y solo en una estadía vinculada.
create policy mensajes_mesa_insert_cliente
  on public.mensajes_mesa
  for insert
  to anon, authenticated
  with check (
    mensajes_mesa.empleado_id is null
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = mensajes_mesa.solicitud_id
        and s.estado = 'vinculado'
    )
  );

-- Mozo: escribe con su propio empleado_id, tiene que estar activo y la
-- estadía tiene que estar vinculada.
create policy mensajes_mesa_insert_mozo
  on public.mensajes_mesa
  for insert
  to authenticated
  with check (
    mensajes_mesa.empleado_id = public.empleado_id_actual()
    and exists (
      select 1
      from public.empleados e
      where e.id = mensajes_mesa.empleado_id
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = mensajes_mesa.solicitud_id
        and s.estado = 'vinculado'
    )
  );

-- Sin políticas de update ni delete: nadie modifica ni borra mensajes.

-- ---------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.mensajes_mesa;
