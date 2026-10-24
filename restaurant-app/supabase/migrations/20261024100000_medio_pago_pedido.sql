-- =====================================================================
-- Punto 21 · Medio de pago del pedido
--
-- Con la cuenta pedida y la propina ya elegida, el cliente toca «Ir a
-- pagar» y elige cómo va a pagar: efectivo, tarjeta o Mercado Pago. Lo
-- puede cambiar hasta que el mozo confirme el pago (punto 22). El pago en
-- sí lo registra el mozo: esto solo le avisa con qué medio paga la mesa.
--
--   pedidos.medio_pago   null = todavía no eligió
--
-- Sin RPC: update directo de la columna, con permiso por columna.
--
-- RLS: la base de prueba lo tiene desactivado, así que la política queda
-- escrita y las mismas reglas se aplican en PedidosService.fijarMedioPago()
-- (update con filtros por estado y propina). El check y el grant rigen siempre.
-- =====================================================================

alter table public.pedidos
  add column medio_pago text;

alter table public.pedidos
  add constraint pedidos_medio_pago_check
  check (medio_pago in ('efectivo', 'tarjeta', 'mercado_pago'));

grant update (medio_pago) on public.pedidos to anon, authenticated;

-- alter table public.pedidos enable row level security;

-- Cliente (anónimo o registrado): elige el medio solo en el pedido de su
-- estadía vinculada, con la cuenta pedida y la propina ya elegida. El
-- estado queda en 'cuenta_pedida' en ambas cláusulas: esta política no
-- sirve para mover el estado.
create policy pedidos_update_medio_pago_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'cuenta_pedida'
    and pedidos.propina_porcentaje is not null
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
    and public.empleado_id_actual() is null
  );
