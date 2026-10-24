-- =====================================================================
-- Punto 21 · La propina queda bloqueada una vez elegido el medio de pago
--
-- Con el medio de pago elegido el cliente ya no puede cambiar la propina.
-- Si el mozo rechaza el medio (medio_pago vuelve a null), la propina se
-- puede volver a cambiar.
--
-- Se reemplaza la política de 20261023160000: ahora exige medio_pago null.
--
-- RLS: la base de prueba lo tiene desactivado, así que la misma regla se
-- aplica en PedidosService.fijarPropina() (filtro por medio_pago).
-- =====================================================================

drop policy pedidos_update_propina_cliente on public.pedidos;

create policy pedidos_update_propina_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'cuenta_pedida'
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
    and pedidos.medio_pago is null
    and public.empleado_id_actual() is null
  );
