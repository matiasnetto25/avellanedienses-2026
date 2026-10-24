-- =====================================================================
-- Punto 21 · Primer paso: el cliente pide la cuenta
--
--   entregado  ->  cuenta_pedida     el CLIENTE toca «Pedir la cuenta»
--
-- Solo se puede pedir la cuenta de un pedido ya entregado (el cliente
-- confirmó que lo recibió). El mozo se entera por push. La propina por
-- QR, el detalle de la cuenta y el pago (puntos 21 y 22) suman sus
-- estados y políticas en migraciones propias.
--
-- Sin RPC: update directo de pedidos.estado (el permiso por columna lo
-- dio el punto 13).
--
-- RLS: la base de prueba lo tiene desactivado, así que la política queda
-- escrita y las mismas reglas se aplican en PedidosService.pedirCuenta()
-- (update con filtro por estado). El check de estados sí rige siempre.
-- =====================================================================

alter table public.pedidos drop constraint pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check
  check (estado in (
    'pendiente_confirmacion',
    'rechazado',
    'confirmado',
    'pendiente_recepcion',
    'entregado',
    'cuenta_pedida'
  ));

-- alter table public.pedidos enable row level security;

-- Cliente (anónimo o registrado): entregado -> cuenta_pedida, solo en el
-- pedido de su estadía vinculada. Los empleados quedan excluidos.
-- El "todos listos" frena el cruce con otras políticas (using de una,
-- with check de otra): un pedido rechazado no tiene ítems listos.
create policy pedidos_update_pedir_cuenta_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'entregado'
    and public.empleado_id_actual() is null
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = pedidos.solicitud_id
        and s.estado = 'vinculado'
    )
  )
  with check (
    pedidos.estado = 'cuenta_pedida'
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
