-- =====================================================================
-- Punto 21 · Propina del pedido (QR de propina)
--
-- Con la cuenta pedida (estado 'cuenta_pedida'), el cliente deja la
-- propina leyendo uno de los 5 QR de propina: 0, 5, 10, 15 o 20 %. La
-- puede cambiar hasta que el mozo confirme el pago (punto 22).
--
--   pedidos.propina_porcentaje   null = todavía no escaneó el QR
--
-- Solo se guarda el porcentaje: el monto y el total a pagar se calculan
-- en el front, igual que el descuento de los juegos.
--
-- Sin RPC: update directo de la columna. El permiso por columna es
-- aparte del de «estado» (punto 13).
--
-- RLS: la base de prueba lo tiene desactivado, así que la política queda
-- escrita y las mismas reglas se aplican en PedidosService.fijarPropina()
-- (update con filtro por estado). El check y el grant rigen siempre.
-- =====================================================================

alter table public.pedidos
  add column propina_porcentaje smallint;

alter table public.pedidos
  add constraint pedidos_propina_check
  check (propina_porcentaje in (0, 5, 10, 15, 20));

grant update (propina_porcentaje) on public.pedidos to anon, authenticated;

-- alter table public.pedidos enable row level security;

-- Cliente (anónimo o registrado): fija la propina solo en el pedido de su
-- estadía vinculada y mientras la cuenta está pedida. El estado tiene que
-- seguir en 'cuenta_pedida' en ambas cláusulas: así esta política no sirve
-- para mover el estado (using de una + with check de otra se combinan).
create policy pedidos_update_propina_cliente
  on public.pedidos
  for update
  to anon, authenticated
  using (
    pedidos.estado = 'cuenta_pedida'
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
  );
