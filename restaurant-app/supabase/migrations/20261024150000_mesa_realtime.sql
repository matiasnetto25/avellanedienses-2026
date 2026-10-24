-- =====================================================================
-- Realtime para la tabla mesa
--
-- El salón del dueño y del supervisor (gestión de mesas y pantalla
-- «Ahora») ve el estado de las mesas en tiempo real: cuando el metre
-- asigna una mesa o el cliente termina su visita (punto 22), la mesa pasa
-- a Ocupada o a Libre y la pantalla se actualiza sola.
--
-- Realtime respeta RLS. Se agrega la tabla a la publicación solo si no
-- estaba, así la migración se puede volver a correr.
-- =====================================================================

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mesa'
  ) then
    alter publication supabase_realtime add table public.mesa;
  end if;
end
$$;
