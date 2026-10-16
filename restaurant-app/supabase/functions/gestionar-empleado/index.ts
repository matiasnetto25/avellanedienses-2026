import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Modificar o eliminar un empleado (pantalla Personal → Empleados).
 *
 * Se hace acá, con la service-role key, porque desde la app NO se puede:
 *  - borrar el usuario de Supabase Auth del empleado,
 *  - borrar su foto del bucket (el cliente público no tiene permiso).
 *
 * Y porque los permisos se validan SIEMPRE del lado del servidor, aunque la
 * app ya oculte los botones que no corresponden:
 *  - Solo dueño y supervisor (con estado 'On') pueden usar esta función.
 *  - El dueño gestiona a todos los puestos; el supervisor, solo a mozo,
 *    metre, cocinero y cantinero.
 *  - Nadie puede eliminarse a sí mismo ni cambiarse el propio puesto.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUCKET_EMPLEADOS = 'empleado';

const PUESTOS_TODOS = ['dueño', 'supervisor', 'mozo', 'metre', 'cocinero', 'cantinero'];
const PUESTOS_DEL_SUPERVISOR = ['mozo', 'metre', 'cocinero', 'cantinero'];

const REGEX_TEXTO = /^[\p{L}\s'.-]+$/u;

function respuesta(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fallo(mensaje: string) {
  return respuesta({ ok: false, error: { message: mensaje } });
}

function puestosGestionables(puestoQuienGestiona: string): string[] {
  if (puestoQuienGestiona === 'dueño') return PUESTOS_TODOS;
  if (puestoQuienGestiona === 'supervisor') return PUESTOS_DEL_SUPERVISOR;
  return [];
}

function textoValido(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.trim().length >= 4 && REGEX_TEXTO.test(valor.trim());
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1) Quién llama: el JWT de la sesión que manda supabase-js.
    const token = req.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return fallo('No hay una sesión iniciada.');

    const { data: datosUsuario, error: errorUsuario } = await supabaseAdmin.auth.getUser(token);
    if (errorUsuario || !datosUsuario?.user) return fallo('La sesión no es válida. Volvé a iniciar sesión.');

    const { data: quien } = await supabaseAdmin
      .from('empleados')
      .select('id, puesto, estado')
      .eq('auth_user_id', datosUsuario.user.id)
      .maybeSingle();

    if (!quien || quien.estado !== 'On' || !['dueño', 'supervisor'].includes(quien.puesto)) {
      return fallo('No tenés permisos para gestionar empleados.');
    }

    // 2) Qué se pide y sobre quién.
    const { accion, empleadoId, cambios } = await req.json();
    if (!['actualizar', 'eliminar'].includes(accion) || !Number.isInteger(empleadoId)) {
      return fallo('Pedido inválido.');
    }

    const { data: objetivo } = await supabaseAdmin
      .from('empleados')
      .select('id, auth_user_id, puesto, foto, nombre, apellido')
      .eq('id', empleadoId)
      .maybeSingle();

    if (!objetivo) return fallo('El empleado ya no existe.');

    const gestionables = puestosGestionables(quien.puesto);
    if (!gestionables.includes(objetivo.puesto)) {
      return fallo('No tenés permisos para gestionar a un empleado con ese puesto.');
    }

    const esUnoMismo = objetivo.id === quien.id;

    // ---------------------------------------------------------------- eliminar
    if (accion === 'eliminar') {
      if (esUnoMismo) return fallo('No podés eliminar tu propia cuenta.');

      const { error: errorFila } = await supabaseAdmin.from('empleados').delete().eq('id', objetivo.id);
      if (errorFila) {
        console.error('Error borrando empleado ->', JSON.stringify(errorFila));
        // 23503 = otra tabla (pedidos, mensajes, etc.) todavía lo referencia.
        if (errorFila.code === '23503') {
          return fallo('Este empleado tiene actividad registrada (pedidos o mensajes) y no se puede eliminar.');
        }
        return fallo('No se pudo eliminar al empleado.');
      }

      // La fila ya no existe: lo que sigue no es motivo para reportar falla.
      if (objetivo.auth_user_id) {
        const { error: errorAuth } = await supabaseAdmin.auth.admin.deleteUser(objetivo.auth_user_id);
        if (errorAuth) console.error('Error borrando usuario de Auth ->', JSON.stringify(errorAuth));
      }
      if (objetivo.foto) {
        const { error: errorFoto } = await supabaseAdmin.storage.from(BUCKET_EMPLEADOS).remove([objetivo.foto]);
        if (errorFoto) console.error('Error borrando foto del empleado ->', JSON.stringify(errorFoto));
      }

      return respuesta({ ok: true, nombre: objetivo.nombre, apellido: objetivo.apellido, puesto: objetivo.puesto });
    }

    // --------------------------------------------------------------- actualizar
    const { nombre, apellido, puesto, foto } = cambios ?? {};

    if (!textoValido(nombre)) return fallo('El nombre no es válido.');
    if (!textoValido(apellido)) return fallo('El apellido no es válido.');
    if (!gestionables.includes(puesto)) return fallo('No tenés permisos para asignar ese puesto.');
    if (esUnoMismo && puesto !== objetivo.puesto) return fallo('No podés cambiar tu propio puesto.');

    const datos: Record<string, unknown> = {
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      puesto,
    };

    if (foto !== undefined && foto !== null) {
      // La app sube la foto nueva con el CUIL como prefijo; se verifica que
      // sea un nombre de archivo simple y que de verdad exista en el bucket.
      if (typeof foto !== 'string' || !/^[\w.-]+\.jpg$/.test(foto)) return fallo('La foto no es válida.');
      const { data: archivos } = await supabaseAdmin.storage.from(BUCKET_EMPLEADOS).list('', { search: foto });
      if (!archivos?.some((a) => a.name === foto)) return fallo('No se encontró la foto subida.');
      datos.foto = foto;
    }

    const { data: actualizado, error: errorUpdate } = await supabaseAdmin
      .from('empleados')
      .update(datos)
      .eq('id', objetivo.id)
      .select('id, nombre, apellido, puesto, foto')
      .single();

    if (errorUpdate) {
      console.error('Error actualizando empleado ->', JSON.stringify(errorUpdate));
      return fallo('No se pudo guardar los cambios del empleado.');
    }

    // Foto reemplazada: la anterior ya no la usa nadie.
    if (datos.foto && objetivo.foto && objetivo.foto !== datos.foto) {
      const { error: errorFoto } = await supabaseAdmin.storage.from(BUCKET_EMPLEADOS).remove([objetivo.foto]);
      if (errorFoto) console.error('Error borrando foto anterior ->', JSON.stringify(errorFoto));
    }

    return respuesta({ ok: true, empleado: actualizado });
  } catch (err) {
    return fallo(err instanceof Error ? err.message : String(err));
  }
});