-- =====================================================================
-- Punto 21 · El medio de pago queda congelado hasta que el mozo lo rechaza
--
-- Una vez que el cliente elige el medio de pago no puede cambiarlo. Solo
-- si el mozo lo rechaza vuelve a quedar sin elegir (medio_pago = null) y
-- el cliente puede elegir otro.
--
--   cliente  : medio_pago null  -> valor      (elegir)
--   mozo     : medio_pago valor -> null       (rechazar)
--
-- Se reemplaza la política del cliente de 20261024100000 para exigir que
-- todavía no haya medio elegido, y se suma la del mozo.
--
-- RLS: la base de prueba lo tiene desactivado, así que las mismas reglas
-- se aplican en PedidosService.fijarMedioPago() y rechazarMedioPago()
-- (updates con filtros por estado y por medio_pago).
-- =====================================================================

drop policy pedidos_update_medio_pago_cliente on public.pedidos;

create policy pedidos_update_medio_pago_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'cuenta_pedida'
    and pedidos.propina_porcentaje is not null
    and pedidos.medio_pago is null
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
    and pedidos.propina_porcentaje is not null
    and pedidos.medio_pago is not null
    and public.empleado_id_actual() is null
  );

-- Mozo: rechaza el medio de pago elegido. El estado y la propina no cambian.
create policy pedidos_update_rechazo_medio_pago_mozo
  on public.pedidos
  for update
  to authenticated
  using (
    pedidos.estado = 'cuenta_pedida'
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
    pedidos.estado = 'cuenta_pedida'
    and pedidos.medio_pago is null
    and pedidos.propina_porcentaje is not null
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
  );
