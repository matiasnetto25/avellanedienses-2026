-- =====================================================================
-- Realtime para clientes
--
-- «Ahora» del dueño y del supervisor muestra en vivo los clientes
-- pendientes de aprobación (y el contador de la pestaña). Sin cambios de
-- políticas: Realtime respeta RLS, y el dueño y el supervisor ya pueden
-- leer la tabla (lo usa la lista de solicitudes).
-- =====================================================================

alter publication supabase_realtime add table public.clientes;
