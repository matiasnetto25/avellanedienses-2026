/**
 * Plantillas de email con el branding de la app (logo, colores, tipografía).
 * Se usan para los emails de aprobado/rechazado de clientes (y cualquier
 * otro email transaccional que se agregue después).
 *
 * El logo va embebido como base64 (data URI) porque los clientes de email
 * NO pueden cargar assets relativos de la app (rutas tipo "assets/..." no
 * existen fuera del navegador de la app) — así funciona en cualquier
 * cliente de correo sin depender de que la app esté online.
 */

const LOGO_URL = 'https://idojahyttgjwvgpgfywb.supabase.co/storage/v1/object/public/branding/logo-email.png?v=2';

const COLOR_ACCENT = '#7d1a23';
const COLOR_ACCENT_OSCURO = '#5a1119';
const COLOR_FONDO = '#f5f5f4';
const COLOR_TEXTO = '#2b1012';

// Tono "rechazo": rojo en lugar del burdeos de marca, para que el email
// se distinga a simple vista de uno de aprobación (antes de leerlo).
const COLOR_RECHAZO = '#d32f2f';
const COLOR_RECHAZO_OSCURO = '#9f1717';
const COLOR_RECHAZO_FONDO = '#fde4e4';

// Tono "aprobado": encabezado vino (marca) + acentos verdes sobre fondo blanco.
const COLOR_APROBADO = '#2e7d4f';
const COLOR_APROBADO_OSCURO = '#1f5c39';
const COLOR_APROBADO_FONDO = '#e6f3ea';

type TonoEmail = 'marca' | 'rechazo' | 'aprobado';

function envolverEmail(tituloInterno: string, cuerpoHtml: string, tono: TonoEmail = 'marca'): string {
  const claro = tono === 'rechazo' ? COLOR_RECHAZO : COLOR_ACCENT;
  const oscuro = tono === 'rechazo' ? COLOR_RECHAZO_OSCURO : COLOR_ACCENT_OSCURO;
  const colorFranja = tono === 'rechazo' ? COLOR_RECHAZO_FONDO : tono === 'aprobado' ? COLOR_APROBADO : '';
  const franja = colorFranja
    ? `<tr><td style="height: 6px; background-color: ${colorFranja}; font-size: 0; line-height: 0;">&nbsp;</td></tr>`
    : '';
  return `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${tituloInterno}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${COLOR_FONDO}; font-family: Georgia, 'Times New Roman', serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLOR_FONDO};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 480px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08);">

            <!-- Encabezado con logo -->
            <tr>
              <td align="center" bgcolor="${claro}" style="background-color: ${claro}; background: linear-gradient(180deg, ${claro} 0%, ${oscuro} 100%); padding: 32px 24px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto 12px;">
                  <tr>
                    <td style="width: 88px; height: 88px; background-color: #ffffff; border-radius: 50%; text-align: center; vertical-align: middle;">
                      <img src="${LOGO_URL}" width="60" height="60" alt="Merlot" style="display:block; margin: 14px auto;" />
                    </td>
                  </tr>
                </table>
                <div style="font-family: Georgia, 'Times New Roman', serif; color:#ffffff; font-size: 22px; letter-spacing: 2px; text-transform: uppercase;">
                  Merlot
                </div>
              </td>
            </tr>
            ${franja}

            <!-- Cuerpo -->
            <tr>
              <td style="padding: 32px 28px;">
                ${cuerpoHtml}
              </td>
            </tr>

            <!-- Pie -->
            <tr>
              <td align="center" style="padding: 20px 24px 28px; border-top: 1px solid #eee;">
                <div style="font-family: Arial, Helvetica, sans-serif; color: #999999; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase;">
                  Avellanedienses &middot; Merlot
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

/** Email enviado cuando dueño/supervisor APRUEBA el registro de un cliente. */
export function plantillaClienteAprobado(nombre: string): string {
  const cuerpo = `
    <div style="text-align: center; margin: 0 0 20px;">
      <span style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background-color: ${COLOR_APROBADO}; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; text-align: center;">
        &#10003;
      </span>
    </div>
    <h1 style="margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; color: ${COLOR_ACCENT}; font-size: 26px; font-weight: normal; text-align: center;">
      ¡Bienvenido/a, ${nombre}!
    </h1>
    <p style="margin: 0 0 24px; text-align: center;">
      <span style="display: inline-block; padding: 6px 14px; background-color: ${COLOR_APROBADO_FONDO}; color: ${COLOR_APROBADO_OSCURO}; border: 1px solid ${COLOR_APROBADO}; border-radius: 999px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">
        Registro aprobado
      </span>
    </p>
    <div style="margin: 0 0 24px; padding: 18px 20px; background-color: ${COLOR_APROBADO_FONDO}; border-left: 4px solid ${COLOR_APROBADO}; border-radius: 8px;">
      <p style="margin: 0 0 12px; font-family: Arial, Helvetica, sans-serif; color: ${COLOR_TEXTO}; font-size: 15px; line-height: 1.6;">
        Hola ${nombre}, tenemos el gusto de confirmarte que tu registro en <strong style="color: ${COLOR_ACCENT};">Merlot</strong> fue aprobado por nuestro equipo.
      </p>
      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; color: ${COLOR_TEXTO}; font-size: 15px; line-height: 1.6;">
        Ya podés ingresar a la aplicación con tu email y contraseña, y disfrutar de todos los beneficios de ser cliente registrado: reservar tu lugar, seguir tus pedidos y mucho más.
      </p>
    </div>
    <div style="text-align: center; margin: 28px 0 8px;">
      <span style="display: inline-block; padding: 12px 28px; background-color: ${COLOR_APROBADO}; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: bold; border-radius: 10px; letter-spacing: 0.5px;">
        ¡Te esperamos!
      </span>
    </div>
  `;
  return envolverEmail('Tu registro fue aprobado', cuerpo.trim(), 'aprobado');
}

/** Email enviado cuando dueño/supervisor RECHAZA el registro de un cliente. */
export function plantillaClienteRechazado(nombre: string): string {
  const cuerpo = `
    <div style="text-align: center; margin: 0 0 20px;">
      <span style="display: inline-block; width: 56px; height: 56px; line-height: 56px; border-radius: 50%; background-color: ${COLOR_RECHAZO}; color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 28px; font-weight: bold; text-align: center;">
        &#10005;
      </span>
    </div>
    <h1 style="margin: 0 0 8px; font-family: Georgia, 'Times New Roman', serif; color: ${COLOR_TEXTO}; font-size: 24px; font-weight: normal; text-align: center;">
      Hola, ${nombre}
    </h1>
    <p style="margin: 0 0 24px; text-align: center;">
      <span style="display: inline-block; padding: 6px 14px; background-color: ${COLOR_RECHAZO_FONDO}; color: ${COLOR_RECHAZO_OSCURO}; border: 1px solid ${COLOR_RECHAZO}; border-radius: 999px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; letter-spacing: 1px; text-transform: uppercase; font-weight: bold;">
        Registro no aprobado
      </span>
    </p>
    <div style="margin: 0 0 24px; padding: 18px 20px; background-color: ${COLOR_RECHAZO_FONDO}; border-left: 4px solid ${COLOR_RECHAZO}; border-radius: 8px;">
      <p style="margin: 0 0 12px; font-family: Arial, Helvetica, sans-serif; color: ${COLOR_TEXTO}; font-size: 15px; line-height: 1.6;">
        Te escribimos para informarte que, luego de revisar tu solicitud de registro en <strong>Merlot</strong>, no pudimos aprobarla en esta oportunidad.
      </p>
      <p style="margin: 0; font-family: Arial, Helvetica, sans-serif; color: ${COLOR_TEXTO}; font-size: 15px; line-height: 1.6;">
        Si creés que se trata de un error, o querés más información, no dudes en contactarnos directamente en el local.
      </p>
    </div>
  `;
  return envolverEmail('Sobre tu registro', cuerpo.trim(), 'rechazo');
}