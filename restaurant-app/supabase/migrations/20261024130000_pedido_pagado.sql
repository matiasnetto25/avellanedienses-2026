-- =====================================================================
-- Punto 22 · El mozo confirma el pago
--
--   cuenta_pedida  ->  pagado     el MOZO toca «Confirmar pago»
--
-- Solo se puede confirmar con la propina elegida y el medio de pago
-- elegido por el cliente (y no rechazado). Con el pago confirmado, el
-- cliente escanea el QR de su mesa para terminar la estadía: ese paso
-- libera la mesa (migración propia).
--
-- Sin RPC: update directo de pedidos.estado (el permiso por columna lo
-- dio el punto 13).
--
-- Encuesta: sigue habilitada con el pedido pagado (el cliente todavía no
-- terminó la estadía), así que se suma 'pagado' a encuestas_insert_cliente.
--
-- RLS: la base de prueba lo tiene desactivado, así que las reglas también
-- se aplican en PedidosService.confirmarPago() (update con filtros por
-- estado, propina y medio de pago). El check de estados sí rige siempre.
-- =====================================================================

alter table public.pedidos drop constraint pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check
  check (estado in (
    'pendiente_confirmacion',
    'rechazado',
    'confirmado',
    'pendiente_recepcion',
    'entregado',
    'cuenta_pedida',
    'pagado'
  ));

-- alter table public.pedidos enable row level security;

-- Mozo: cuenta_pedida -> pagado, con propina y medio de pago elegidos.
-- El estado y los datos se repiten en using y with check por la trampa de
-- las políticas permisivas (using de una + with check de otra).
create policy pedidos_update_pago_mozo
  on public.pedidos
  for update
  to authenticated
  using (
    pedidos.estado = 'cuenta_pedida'
    and pedidos.propina_porcentaje is not null
    and pedidos.medio_pago is not null
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
  )
  with check (
    pedidos.estado = 'pagado'
    and pedidos.propina_porcentaje is not null
    and pedidos.medio_pago is not null
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
  );

-- La encuesta sigue disponible con el pedido pagado.
drop policy encuestas_insert_cliente on public.encuestas;

create policy encuestas_insert_cliente
  on public.encuestas
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.solicitudes_mesa s
      join public.pedidos p on p.solicitud_id = s.id
      where s.id = encuestas.solicitud_id
        and s.estado = 'vinculado'
        and p.estado in ('entregado', 'cuenta_pedida', 'pagado')
    )
  );
