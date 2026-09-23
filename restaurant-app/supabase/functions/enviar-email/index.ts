import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SmtpClient } from "https://deno.land/x/denomailer@0.16.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const GMAIL_USER = Deno.env.get('GMAIL_USER')!;
const GMAIL_APP_PASSWORD = Deno.env.get('GMAIL_APP_PASSWORD')!;

function respuesta(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const { destinatario, asunto, html } = await req.json();

    if (!destinatario || !asunto || !html) {
      return respuesta({ ok: false, error: { message: 'Faltan destinatario, asunto o html.' } });
    }

    const client = new SmtpClient({ content_encoding: 'base64' });

    try {
      await client.connectTLS({
        hostname: 'smtp.gmail.com',
        port: 465,
        username: GMAIL_USER,
        password: GMAIL_APP_PASSWORD,
      });

      await client.send({
        from: `Merlot <${GMAIL_USER}>`,
        to: destinatario,
        subject: asunto,
        html,
        content: 'Este correo requiere un cliente compatible con HTML.',
      });
    } finally {
      await client.close();
    }

    return respuesta({ ok: true });
  } catch (err) {
    console.error('Error enviando email por Gmail SMTP:', err);
    return respuesta({
      ok: false,
      error: { message: err instanceof Error ? err.message : String(err) },
    });
  }
});
