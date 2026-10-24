-- =====================================================================
-- Punto 19 · Entrega del pedido y confirmación del cliente
--
-- Flujo:
--   confirmado            (cocina y bar preparan; punto 14 a 18)
--     -> pendiente_recepcion   el MOZO lo lleva a la mesa y toca «Entregar»
--     -> entregado             el CLIENTE confirma que lo recibió
--     -> confirmado            el CLIENTE toca «Todavía no lo recibí»: el
--                              pedido vuelve al mozo para entregarlo de nuevo
--
-- El estado 'entregado' lo pone solo el cliente. No hay vencimiento ni
-- confirmación automática: el pedido espera hasta que el cliente toque
-- «Recibí mi pedido».
--
-- Sin RPC: ambos pasos son update directo de pedidos.estado. El permiso
-- por columna (estado, motivo_rechazo) ya lo dio el punto 13.
--
-- Se elimina entregar_pedido(uuid): el front la llamaba pero no estaba
-- versionada en ninguna migración. Si existía en la base, se borra.
--
-- RLS: la base de prueba lo tiene desactivado. Las políticas quedan
-- escritas y el enable comentado, igual que en el punto 20. Las mismas
-- reglas se aplican también en PedidosService (update con filtro por
-- estado). El check de estados sí rige siempre.
-- =====================================================================

drop function if exists public.entregar_pedido(uuid);

-- ---------------------------------------------------------------------
-- Estados nuevos
-- ---------------------------------------------------------------------
alter table public.pedidos drop constraint pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check
  check (estado in (
    'pendiente_confirmacion',
    'rechazado',
    'confirmado',
    'pendiente_recepcion',
    'entregado'
  ));

-- ---------------------------------------------------------------------
-- Seguridad (RLS)
-- ---------------------------------------------------------------------
-- alter table public.pedidos enable row level security;

-- Mozo: confirmado -> pendiente_recepcion, solo si el pedido tiene ítems
-- y TODOS están listos.
-- Trampa de las políticas permisivas: using y with check se evalúan por
-- separado entre políticas, así que un mozo podría llegar a
-- 'pendiente_recepcion' desde 'pendiente_confirmacion'. Lo frena el
-- "todos listos": un pedido sin confirmar no tiene ítems listos.
create policy pedidos_update_entrega_mozo
  on public.pedidos
  for update
  to authenticated
  using (
    pedidos.estado = 'confirmado'
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
  )
  with check (
    pedidos.estado = 'pendiente_recepcion'
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
    and exists (
      select 1 from public.pedido_items i where i.pedido_id = pedidos.id
    )
    and not exists (
      select 1
      from public.pedido_items i
      where i.pedido_id = pedidos.id
        and i.estado <> 'listo'
    )
  );

-- Cliente (anónimo o registrado): pendiente_recepcion -> entregado, solo
-- en el pedido de su estadía vinculada. Los empleados quedan excluidos.
-- El "todos listos" cierra el mismo cruce de políticas de arriba: un
-- pedido rechazado nunca tiene ítems listos.
create policy pedidos_update_recepcion_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'pendiente_recepcion'
    and public.empleado_id_actual() is null
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = pedidos.solicitud_id
        and s.estado = 'vinculado'
    )
  )
  with check (
    pedidos.estado = 'entregado'
    and public.empleado_id_actual() is null
    and not exists (
      select 1
      from public.pedido_items i
      where i.pedido_id = pedidos.id
        and i.estado <> 'listo'
    )
  );

-- Cliente: «Todavía no lo recibí». pendiente_recepcion -> confirmado: el
-- pedido vuelve a «listo para entregar» y el mozo lo tiene que entregar
-- de nuevo. Mismo "todos listos" que arriba, por el cruce de políticas.
create policy pedidos_update_no_recibido_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'pendiente_recepcion'
    and public.empleado_id_actual() is null
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = pedidos.solicitud_id
        and s.estado = 'vinculado'
    )
  )
  with check (
    pedidos.estado = 'confirmado'
    and public.empleado_id_actual() is null
    and exists (
      select 1 from public.pedido_items i where i.pedido_id = pedidos.id
    )
    and not exists (
      select 1
      from public.pedido_items i
      where i.pedido_id = pedidos.id
        and i.estado <> 'listo'
    )
  );
