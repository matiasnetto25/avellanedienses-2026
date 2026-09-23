import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from "npm:jose";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const FIREBASE_SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

// Mismo mecanismo de firma que ya usás y funciona (firma manual del JWT
// con jose, sin depender de google-auth-library).
async function obtenerAccessToken(serviceAccount: any): Promise<string> {
  const privateKey = await importPKCS8(serviceAccount.private_key, "RS256");
  const ahora = Math.floor(Date.now() / 1000);

  const jwt = await new SignJWT({
    iss: serviceAccount.client_email,
    scope: FIREBASE_SCOPE,
    aud: "https://oauth2.googleapis.com/token",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(ahora)
    .setExpirationTime(ahora + 3600)
    .sign(privateKey);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Error obteniendo token de Google: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  try {
    const { titulo, mensaje, puestos, clienteId, data = {} } = await req.json();

    if (!titulo || !mensaje) {
      return new Response(
        JSON.stringify({ ok: false, error: { message: 'Falta título o mensaje.' } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1) Buscar los tokens: por cliente puntual, o por puesto(s) de empleado.
    let tokens: string[];

    if (clienteId) {
      const { data: fila, error: errorCliente } = await supabaseAdmin
        .from('push_tokens')
        .select('token')
        .eq('cliente_id', clienteId)
        .maybeSingle();

      if (errorCliente) throw errorCliente;
      tokens = fila ? [fila.token] : [];
    } else {
      let query = supabaseAdmin
        .from('push_tokens')
        .select('token, empleado_id, empleados!inner(puesto)');

      if (Array.isArray(puestos) && puestos.length) {
        query = query.in('empleados.puesto', puestos);
      }

      const { data: filas, error: errorConsulta } = await query;
      if (errorConsulta) throw errorConsulta;

      tokens = (filas ?? []).map((f: { token: string }) => f.token);
    }

    if (!tokens.length) {
      return new Response(
        JSON.stringify({ ok: true, enviados: 0, mensaje: 'No hay dispositivos registrados.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2) Cuenta de servicio (mismo formato que ya usás: base64 del JSON completo)
    const serviceAccountBase64 = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_B64');
    if (!serviceAccountBase64) {
      throw new Error('No existe FIREBASE_SERVICE_ACCOUNT_B64');
    }
    const serviceAccount = JSON.parse(atob(serviceAccountBase64));

    const accessToken = await obtenerAccessToken(serviceAccount);
    const url = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;

    // 3) Un request a FCM por cada token (fan-out en paralelo).
    let enviados = 0;
    const errores: string[] = [];

    await Promise.all(
      tokens.map(async (token: string) => {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token,
              notification: { title: titulo, body: mensaje },
              data,
            },
          }),
        });

        if (resp.ok) {
          enviados++;
        } else {
          errores.push(await resp.text());
        }
      })
    );

    return new Response(
      JSON.stringify({ ok: true, enviados, errores }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: { message: err instanceof Error ? err.message : String(err) },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
