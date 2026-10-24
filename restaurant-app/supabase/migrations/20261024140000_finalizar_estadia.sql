-- =====================================================================
-- Punto 22 · El cliente termina la estadía escaneando el QR de su mesa
--
-- Con el pago confirmado (pedido 'pagado'), el cliente escanea el QR de
-- su mesa. Ese escaneo hace dos updates directos, en este orden:
--
--   1. solicitudes_mesa.estado   vinculado -> finalizado
--   2. mesa.disponibilidad       Ocupada   -> Libre
--
-- y la mesa queda disponible para el próximo cliente. El cliente vuelve
-- al principio (escanear el QR de ingreso).
--
-- IMPORTANTE: las tablas mesa y solicitudes_mesa y sus funciones no
-- están en las migraciones del repo (se crearon antes). Por eso el check
-- de estados se reemplaza buscándolo por su definición en vez de por
-- nombre. Revisar con .scratch/punto-22-confirmacion-pago/relevamiento-mesas.sql
-- que obtener_mi_solicitud, solicitar_ingreso y obtener_mesas_libres se
-- comporten bien con el estado nuevo 'finalizado'.
--
-- RLS: la base de prueba lo tiene desactivado, así que las políticas
-- quedan escritas y las mismas reglas se aplican en
-- SolicitudesMesaService.finalizarEstadia() (updates con filtros).
-- =====================================================================

-- 1. 'finalizado' en el check de estados de solicitudes_mesa.
do $$
declare
  nombre text;
begin
  select c.conname into nombre
  from pg_constraint c
  where c.conrelid = 'public.solicitudes_mesa'::regclass
    and c.contype = 'c'
    and pg_get_constraintdef(c.oid) like '%vinculado%'
    and pg_get_constraintdef(c.oid) like '%estado%';

  if nombre is not null then
    execute format('alter table public.solicitudes_mesa drop constraint %I', nombre);
  end if;

  alter table public.solicitudes_mesa
    add constraint solicitudes_mesa_estado_check
    check (estado in ('en_espera', 'aceptado', 'rechazado', 'vinculado', 'finalizado'));
end
$$;

grant update (estado) on public.solicitudes_mesa to anon, authenticated;
grant update (disponibilidad) on public.mesa to anon, authenticated;

-- alter table public.solicitudes_mesa enable row level security;
-- alter table public.mesa enable row level security;

-- Cliente: cierra su propia estadía, solo con el pago ya confirmado.
drop policy if exists solicitudes_mesa_update_finalizar_cliente on public.solicitudes_mesa;

create policy solicitudes_mesa_update_finalizar_cliente
  on public.solicitudes_mesa
  for update
  to anon, authenticated
  using (
    solicitudes_mesa.estado = 'vinculado'
    and public.empleado_id_actual() is null
    and exists (
      select 1
      from public.pedidos p
      where p.solicitud_id = solicitudes_mesa.id
        and p.estado = 'pagado'
    )
  )
  with check (
    solicitudes_mesa.estado = 'finalizado'
    and public.empleado_id_actual() is null
  );

-- Cliente: libera la mesa de una estadía con el pago confirmado.
drop policy if exists mesa_update_liberar_cliente on public.mesa;

create policy mesa_update_liberar_cliente
  on public.mesa
  for update
  to anon, authenticated
  using (
    mesa.disponibilidad = 'Ocupada'
    and public.empleado_id_actual() is null
    and exists (
      select 1
      from public.solicitudes_mesa s
      join public.pedidos p on p.solicitud_id = s.id
      where s.mesa_id = mesa.id
        and s.estado in ('vinculado', 'finalizado')
        and p.estado = 'pagado'
    )
  )
  with check (
    mesa.disponibilidad = 'Libre'
    and public.empleado_id_actual() is null
  );
