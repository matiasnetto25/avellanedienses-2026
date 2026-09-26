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
    const { nombre, apellido, fotoDataUrl } = await req.json();

    if (!nombre || !apellido || !fotoDataUrl) {
      return respuesta({ ok: false, error: { message: 'Faltan nombre, apellido o foto.' } });
    }

    const base64 = String(fotoDataUrl).split(',')[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const nombreArchivo = `anonimo-${crypto.randomUUID()}.jpg`;

    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET_CLIENTES)
      .upload(nombreArchivo, bytes, { contentType: 'image/jpeg', upsert: false });

    if (storageError) {
      return respuesta({ ok: false, error: { message: `No se pudo subir la foto: ${storageError.message}` } });
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('clientes')
      .insert({
        nombre,
        apellido,
        dni: null,
        email: null,
        auth_customer_id: null,
        estado: 'anonimo',
        foto: nombreArchivo,
        en_espera: null,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error insertando cliente anónimo ->', JSON.stringify(insertError));
      await supabaseAdmin.storage.from(BUCKET_CLIENTES).remove([nombreArchivo]);
      return respuesta({
        ok: false,
        error: { message: `No se pudo registrar el cliente: ${insertError.message}` },
      });
    }

    return respuesta({ ok: true, clienteId: data.id });
  } catch (err) {
    return respuesta({
      ok: false,
      error: { message: err instanceof Error ? err.message : String(err) },
    });
  }
});