-- =====================================================================
-- Realtime para solicitudes_mesa
--
-- Cuando el metre acepta o rechaza una solicitud, el cliente anónimo se
-- entera al instante: landing-cliente-anonimo.page.ts escucha los cambios
-- de SU fila (filtro cliente_id=eq.<id>). Antes la tabla no estaba
-- publicada y el cartel solo se actualizaba con el sondeo de 30 segundos.
--
-- Sin cambios de políticas: Realtime respeta RLS, y los clientes ya
-- pueden leer solicitudes_mesa (lo usan el chat y su embedding).
-- =====================================================================

alter publication supabase_realtime add table public.solicitudes_mesa;
