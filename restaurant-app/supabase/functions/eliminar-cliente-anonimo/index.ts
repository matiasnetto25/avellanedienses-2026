import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const BUCKET_CLIENTES = 'cliente';

function respuesta(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const { clienteId } = await req.json();

    if (!clienteId) {
      return respuesta({ ok: false, error: { message: 'Falta clienteId.' } });
    }

    // Toda la lógica de negocio (bloquear si está vinculado, liberar la
    // mesa si estaba aceptada, borrar la solicitud) ya vive en el RPC —
    // acá solo hace falta ejecutarlo y, si vino bien, borrar la foto
    // con permisos de admin (el cliente público no tiene permiso de
    // borrado en el bucket, por eso la foto quedaba huérfana antes).
    const { data, error } = await supabaseAdmin.rpc('eliminar_cliente_anonimo', {
      p_cliente_id: clienteId,
    });

    if (error) {
      console.error('Error en RPC eliminar_cliente_anonimo ->', JSON.stringify(error));
      return respuesta({ ok: false, error: { message: 'No se pudo cerrar la sesión.' } });
    }

    if (!data?.ok) {
      // bloqueado (mesa vinculada) o cualquier otro motivo de negocio
      return respuesta(data);
    }

    if (data.foto) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(BUCKET_CLIENTES)
        .remove([data.foto]);

      if (storageError) {
        console.error('Error borrando foto de cliente anónimo ->', JSON.stringify(storageError));
        // No es motivo para reportar falla: la cuenta ya se borró igual.
      }
    }

    return respuesta(data);
  } catch (err) {
    return respuesta({
      ok: false,
      error: { message: err instanceof Error ? err.message : String(err) },
    });
  }
});