-- =====================================================================
-- Punto 13 · Issue 01 · Rechazo y reenvío del pedido
--
-- El mozo rechaza un pedido que espera confirmación, con un motivo, y el
-- cliente lo corrige y lo vuelve a enviar. Es el MISMO pedido: la
-- estadía tiene uno solo (pedidos_solicitud_unica).
--
-- Sin RPC: las dos operaciones se hacen desde PedidosService con
-- escrituras directas, y estas políticas deciden qué se acepta.
--
-- Rechazo (mozo): un solo update de estado y motivo_rechazo, de
-- 'pendiente_confirmacion' a 'rechazado'. Si dos mozos actúan a la vez,
-- el segundo no encuentra el pedido pendiente y actualiza cero filas.
--
-- Reenvío (cliente): tres pasos, SIEMPRE en este orden:
--   1) delete de los ítems del pedido rechazado,
--   2) insert de los ítems nuevos (precio y sector de la carta),
--   3) update del pedido a 'pendiente_confirmacion', sin motivo.
-- No hay transacción entre los pasos, pero el pedido sigue 'rechazado'
-- (fuera de la lista del mozo, de cocina y de bar) hasta el paso 3, y
-- el paso 3 exige que el pedido tenga ítems. Si falla el 1 o el 2, el
-- cliente reintenta con su carrito. Peor caso: la app se cierra entre
-- el 1 y el 2 y el pedido queda rechazado y vacío; el cliente lo vuelve
-- a armar desde la carta.
--
-- Riesgo aceptado: el cliente anónimo no tiene sesión, así que la base
-- no puede saber de quién es un pedido rechazado. Con la clave pública,
-- alguien podría vaciar o reenviar el pedido rechazado de otra mesa. Es
-- el mismo nivel de riesgo que el punto 12 ya aceptó (cualquiera lee los
-- pedidos y puede agregar ítems a uno pendiente). La app solo opera
-- sobre el pedido de la estadía del cliente actual.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Motivo del rechazo
-- ---------------------------------------------------------------------
-- Obligatorio al rechazar (5 a 200 caracteres sin contar los espacios
-- de los bordes) y solo mientras el pedido está rechazado: al reenviar
-- hay que limpiarlo sí o sí. PedidosService valida lo mismo antes.
alter table public.pedidos
  add constraint pedidos_motivo_rechazo_largo
    check (motivo_rechazo is null or char_length(btrim(motivo_rechazo)) between 5 and 200),
  add constraint pedidos_motivo_rechazo_estado
    check ((estado = 'rechazado') = (motivo_rechazo is not null));

-- ---------------------------------------------------------------------
-- Columnas que se pueden actualizar
-- ---------------------------------------------------------------------
-- Supabase da update sobre TODAS las columnas a anon y authenticated.
-- Las políticas deciden qué filas y qué estados, pero no qué columnas:
-- sin esto, quien pase una política podría cambiar el solicitud_id o el
-- created_at. Solo quedan estado y motivo_rechazo.
--
-- anon lo necesita para el paso 3 del reenvío. El punto 14 (confirmar)
-- y los siguientes reutilizan este permiso sobre "estado": solo tienen
-- que agregar su política.
revoke update on public.pedidos from anon, authenticated;
grant update (estado, motivo_rechazo) on public.pedidos to anon, authenticated;

-- ---------------------------------------------------------------------
-- Rechazo (mozo)
-- ---------------------------------------------------------------------
-- Solo un mozo activo, y solo de 'pendiente_confirmacion' a 'rechazado'.
-- El largo del motivo lo controlan los check de arriba.
create policy pedidos_update_rechazo_mozo
  on public.pedidos
  for update
  to authenticated
  using (
    pedidos.estado = 'pendiente_confirmacion'
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
  )
  with check (
    pedidos.estado = 'rechazado'
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
  );

-- ---------------------------------------------------------------------
-- Reenvío (cliente)
-- ---------------------------------------------------------------------
-- Paso 1: vaciar el pedido, solo mientras está rechazado.
create policy pedido_items_delete_reenvio
  on public.pedido_items
  for delete
  to anon, authenticated
  using (
    exists (
      select 1
      from public.pedidos p
      where p.id = pedido_items.pedido_id
        and p.estado = 'rechazado'
    )
  );

-- Paso 2: la política de insert del punto 12, ampliada para aceptar
-- ítems también en un pedido rechazado. Lo demás no cambia: producto
-- activo, precio exacto de la carta y sector según el tipo.
drop policy pedido_items_insert_cliente on public.pedido_items;

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
        and p.estado in ('pendiente_confirmacion', 'rechazado')
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

-- Paso 3: volver a 'pendiente_confirmacion', sin motivo, con la estadía
-- todavía vinculada y con al menos un ítem (un pedido vacío nunca
-- vuelve a la lista del mozo).
--
-- Las políticas permisivas se combinan con OR: un mozo también pasa por
-- esta, pero lo único que le permite es reenviar un pedido rechazado
-- con ítems. No le da ningún poder que importe.
create policy pedidos_update_reenvio_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'rechazado'
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = pedidos.solicitud_id
        and s.estado = 'vinculado'
    )
  )
  with check (
    pedidos.estado = 'pendiente_confirmacion'
    and pedidos.motivo_rechazo is null
    and exists (
      select 1
      from public.solicitudes_mesa s
      where s.id = pedidos.solicitud_id
        and s.estado = 'vinculado'
    )
    and exists (
      select 1
      from public.pedido_items i
      where i.pedido_id = pedidos.id
    )
  );

-- Realtime: pedidos y pedido_items ya están publicadas (punto 12).
