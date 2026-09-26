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
    const { nombre, apellido, dni, email, password, fotoDataUrl } = await req.json();

    if (!nombre || !apellido || !dni || !email || !password || !fotoDataUrl) {
      return respuesta({ ok: false, error: { message: 'Faltan datos obligatorios.' } });
    }

    const correo = String(email).trim().toLowerCase();

    // Duplicados (defensa server-side, el frontend ya valida esto también).
    const { data: existentePorDni } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('dni', dni)
      .maybeSingle();

    if (existentePorDni) {
      return respuesta({ ok: false, error: { message: 'Ese DNI ya pertenece a un cliente registrado.' } });
    }

    const { data: existentePorEmail } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('email', correo)
      .maybeSingle();

    if (existentePorEmail) {
      return respuesta({ ok: false, error: { message: 'Ese email ya pertenece a un cliente registrado.' } });
    }

    // 1) Usuario de Supabase Auth.
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: correo,
      password,
      email_confirm: true,
    });

    if (authError || !authData?.user) {
      return respuesta({
        ok: false,
        error: { message: authError?.message ?? 'No se pudo crear el usuario.' },
      });
    }

    // 2) Foto a Storage.
    const base64 = String(fotoDataUrl).split(',')[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const nombreArchivo = `${dni}-${Date.now()}.jpg`;

    const { error: storageError } = await supabaseAdmin.storage
      .from(BUCKET_CLIENTES)
      .upload(nombreArchivo, bytes, { contentType: 'image/jpeg', upsert: false });

    if (storageError) {
      // No dejamos un usuario de Auth huérfano si la foto falla.
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      return respuesta({
        ok: false,
        error: { message: `No se pudo subir la foto: ${storageError.message}` },
      });
    }

    // 3) Fila en "clientes".
    const { error: insertError } = await supabaseAdmin.from('clientes').insert({
      auth_customer_id: authData.user.id,
      estado: 'pendiente',
      nombre,
      apellido,
      dni,
      email: correo,
      foto: nombreArchivo,
      en_espera: null,
    });

    if (insertError) {
      console.error('Error insertando cliente ->', JSON.stringify(insertError));
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      await supabaseAdmin.storage.from(BUCKET_CLIENTES).remove([nombreArchivo]);
      return respuesta({
        ok: false,
        error: {
          message: `No se pudo guardar el cliente: ${insertError.message}`,
          code: insertError.code,
          details: insertError.details,
          hint: insertError.hint,
        },
      });
    }

    return respuesta({ ok: true, userId: authData.user.id });
  } catch (err) {
    return respuesta({
      ok: false,
      error: { message: err instanceof Error ? err.message : String(err) },
    });
  }
});
