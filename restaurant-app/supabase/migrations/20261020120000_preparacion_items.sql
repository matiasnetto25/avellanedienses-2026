-- =====================================================================
-- Punto 16 · Cocina empieza a preparar un pedido
--
-- El cocinero toma los ítems de cocina de un pedido confirmado y los pasa
-- de 'pendiente' a 'en_preparacion'. El cliente ve el cambio en vivo
-- (Realtime ya publica pedido_items desde el punto 12).
--
-- Sin RPC: PedidosService.empezarPreparacion() hace un update directo y
-- esta política decide qué se acepta:
--   - Solo un empleado activo cuyo puesto corresponde al sector del ítem
--     (cocinero → 'cocina', cantinero → 'bar'; así el punto 17 reutiliza
--     la misma política sin tocar nada).
--   - Solo de 'pendiente' a 'en_preparacion'.
--   - Solo si el pedido ya está confirmado por el mozo.
-- Doble toma: el update filtra por estado = 'pendiente'. Si dos
-- compañeros tocan el botón a la vez, el segundo actualiza cero filas.
--
-- El paso a 'listo' (punto 18) agrega su propia política.
-- =====================================================================

-- Supabase da update sobre TODAS las columnas a anon y authenticated:
-- solo queda "estado", y solo para authenticated (el cliente no cambia
-- el estado de los ítems).
revoke update on public.pedido_items from anon, authenticated;
grant update (estado) on public.pedido_items to authenticated;

create policy pedido_items_update_preparacion
  on public.pedido_items
  for update
  to authenticated
  using (
    pedido_items.estado = 'pendiente'
    and exists (
      select 1
      from public.pedidos p
      where p.id = pedido_items.pedido_id
        and p.estado = 'confirmado'
    )
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.estado = 'On'
        and (
          (e.puesto = 'cocinero'  and pedido_items.sector = 'cocina')
          or (e.puesto = 'cantinero' and pedido_items.sector = 'bar')
        )
    )
  )
  with check (
    pedido_items.estado = 'en_preparacion'
  );
