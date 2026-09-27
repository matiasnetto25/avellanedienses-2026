-- =====================================================================
-- RPC de tokens de push: versionado y corrección de guardar_push_token
--
-- Estas tres funciones ya existían en la base pero no estaban en el repo.
-- Se versionan acá tal como estaban, salvo UNA corrección:
--
-- guardar_push_token: el ON CONFLICT actualizaba empleado_id pero dejaba
-- cargado cliente_id. Si el celular se había usado antes como cliente, la
-- fila quedaba con los dos y violaba el check push_tokens_uno_u_otro: la
-- RPC fallaba y el empleado nunca recibía push. Ahora limpia cliente_id,
-- igual que registrar_push_token_cliente ya limpiaba empleado_id.
--
-- Regla: cada token (un celular) pertenece a una sola persona, la última
-- que inició sesión en él.
-- =====================================================================

create or replace function public.guardar_push_token(p_token text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_empleado_id integer;
begin
  select id into v_empleado_id
  from public.empleados
  where auth_user_id = auth.uid();

  if v_empleado_id is null then
    raise exception 'No hay empleado asociado al usuario autenticado.';
  end if;

  insert into public.push_tokens (empleado_id, token, actualizado_en)
  values (v_empleado_id, p_token, now())
  on conflict (token)
  do update set empleado_id = excluded.empleado_id, cliente_id = null, actualizado_en = now();
end;
$function$;

-- Sin cambios: se versiona tal como estaba.
create or replace function public.registrar_push_token_cliente(p_cliente_id uuid, p_token text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  insert into public.push_tokens (cliente_id, token, actualizado_en)
  values (p_cliente_id, p_token, now())
  on conflict (token)
  do update set cliente_id = excluded.cliente_id, empleado_id = null, actualizado_en = now();
$function$;

-- Sin cambios: se versiona tal como estaba.
create or replace function public.eliminar_push_token(p_token text)
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  delete from public.push_tokens where token = p_token;
$function$;
