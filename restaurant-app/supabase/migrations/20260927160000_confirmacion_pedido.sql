-- =====================================================================
-- Punto 14 · Issue 01 · Confirmación del pedido
--
-- El mozo confirma un pedido que espera confirmación y, desde ese
-- momento, sus ítems aparecen en las comandas de cocina y de bar.
--
-- Sin RPC: PedidosService.confirmar() hace un solo update directo, y
-- esta política decide qué se acepta:
--   - Solo un mozo activo.
--   - Solo de 'pendiente_confirmacion' a 'confirmado'. Un pedido
--     rechazado (punto 13) no se confirma hasta que el cliente lo
--     reenvía.
--   - Solo si el pedido tiene al menos un ítem: un pedido vacío nunca
--     llega a cocina ni a bar (misma regla que el reenvío del punto 13).
--
-- Doble confirmación: el update filtra por estado =
-- 'pendiente_confirmacion'. Si dos mozos confirman (o uno confirma y
-- otro rechaza) a la vez, el segundo no encuentra el pedido pendiente y
-- actualiza cero filas: PedidosService lo detecta con .select() y no se
-- repiten las push.
--
-- Corrige además la política de reenvío del punto 13, que combinada con
-- esta dejaba a un mozo confirmar un pedido rechazado (ver abajo).
--
-- Lo que NO hace falta tocar:
--   - Permisos de columna: el punto 13 ya dio update (estado,
--     motivo_rechazo) a authenticated. Esta política solo cambia estado.
--   - Checks: pedidos_estado_check ya acepta 'confirmado', y
--     pedidos_motivo_rechazo_estado garantiza que un pedido confirmado
--     no tenga motivo.
--   - Ítems: nacen en 'pendiente' (lo exige pedido_items_insert_cliente,
--     también en el reenvío) y así llegan a las comandas. Los cambian
--     los puntos 16 y 17.
--   - Lectura de comandas: pedidos_select_todos y
--     pedido_items_select_todos (punto 12) ya dejan leer a cocinero y
--     cantinero, y a Realtime entregarles los eventos. El filtro por
--     sector y por pedido confirmado lo hace PedidosService. Riesgo
--     aceptado en el punto 12: lectura pública, sin datos personales.
--   - Realtime: pedidos y pedido_items ya están publicadas.
--
-- Sin columnas de auditoría (confirmado_at, confirmado_por): sin
-- triggers las tendría que completar el front con la hora del celular.
-- Las comandas muestran la hora del pedido (created_at).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reenvío (cliente): solo clientes, nunca empleados
-- ---------------------------------------------------------------------
-- Trampa de RLS: en un update, Postgres junta con OR los "using" de
-- TODAS las políticas permisivas, y por separado los "with check". No
-- se evalúan de a pares. Con la política de confirmación de abajo, un
-- mozo podía "entrar" a un pedido RECHAZADO por el using del reenvío y
-- "salir" a 'confirmado' por el with check de la confirmación:
--   update pedidos set estado = 'confirmado', motivo_rechazo = null
--   where id = <pedido rechazado>;
-- Lo mismo le permitía cambiar el motivo de un pedido ya rechazado
-- (using del reenvío + with check del rechazo).
--
-- Los empleados nunca reenvían pedidos: se los excluye del reenvío.
-- Para el cliente (anon, o registrado con sesión) no cambia nada:
-- empleado_id_actual() es null. Postgres no permite cambiar la
-- condición con alter policy de forma cómoda: drop + create con el
-- mismo nombre, igual que pedido_items_insert_cliente en el punto 13.
drop policy pedidos_update_reenvio_cliente on public.pedidos;

create policy pedidos_update_reenvio_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'rechazado'
    and public.empleado_id_actual() is null
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
    and public.empleado_id_actual() is null
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

-- ---------------------------------------------------------------------
-- Confirmación (mozo)
-- ---------------------------------------------------------------------
-- Combinada con las demás políticas de update (ver la trampa de
-- arriba), un mozo queda así:
--   - "Entra" solo a pedidos 'pendiente_confirmacion' (using del
--     rechazo y de la confirmación).
--   - "Sale" a 'rechazado' (con motivo, por los checks) o a
--     'confirmado' (con ítems).
-- Desde 'confirmado' nadie puede pasar a otro estado todavía: los
-- puntos 16 en adelante agregan sus políticas.
create policy pedidos_update_confirmacion_mozo
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
    pedidos.estado = 'confirmado'
    and exists (
      select 1
      from public.empleados e
      where e.id = public.empleado_id_actual()
        and e.puesto = 'mozo'
        and e.estado = 'On'
    )
    and exists (
      select 1
      from public.pedido_items i
      where i.pedido_id = pedidos.id
    )
  );
