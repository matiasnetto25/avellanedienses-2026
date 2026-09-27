import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

/**
 * Contenido fijo del QR de ingreso al local — es SIEMPRE el mismo texto,
 * no depende de ninguna mesa ni cliente. Se imprime una sola vez y se
 * coloca en la entrada; sirve para que el cliente anónimo pueda ver las
 * mesas disponibles sin necesidad de haber escaneado el QR de una mesa
 * en particular.
 */
export const CONTENIDO_QR_INGRESO = 'MERLOT_INGRESO_SOLICITAR_MESA';

// ===== Formato del QR de la mesa =====
// Generar y leer están juntos a propósito: si cambia el formato de uno,
// hay que cambiar el otro.

/** Contenido del QR impreso en cada mesa: la URL de su pantalla, <origen>/mesa/<uuid>. */
export function contenidoQrMesa(mesaId: string): string {
  return `${window.location.origin}/mesa/${mesaId}`;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de la mesa a partir del texto leído del QR (último segmento de la URL), o null si no es un QR de mesa. */
export function leerIdMesa(textoLeido: string): string | null {
  const partes = textoLeido.split('/').filter(Boolean);
  const mesaId = partes[partes.length - 1] ?? '';
  return REGEX_UUID.test(mesaId) ? mesaId : null;
}

export interface ResultadoEscaneoQr {
  ok: boolean;
  cancelado?: boolean;
  mensaje?: string;
}

export interface ResultadoEscaneoMesa extends ResultadoEscaneoQr {
  mesaId?: string;
}

/** Resultado de la lectura cruda: el texto leído, o por qué no se pudo leer. */
export type ResultadoLectura =
  | { ok: true; texto: string }
  | { ok: false; cancelado?: boolean; mensaje?: string };

@Injectable({ providedIn: 'root' })
export class QrService {
  /** Genera un QR como data URL (imagen PNG en base64), listo para <img [src]="...">  */
  async generarDataUrl(contenido: string): Promise<string> {
    return QRCode.toDataURL(contenido, {
      width: 320,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
  }

  /**
   * Única implementación del escaneo con ML Kit: pide el permiso de
   * cámara, instala el módulo de Google si hace falta (en Android puede no
   * estar descargado la primera vez) y abre su pantalla de escaneo.
   *
   * Devuelve el texto crudo leído, sin validar a qué corresponde: eso lo
   * hace cada caso (QR de ingreso, QR de mesa, DNI).
   *
   * @param queSeEscanea para los mensajes: «el código», «el DNI», etc.
   */
  async escanear(formatos: BarcodeFormat[], queSeEscanea = 'el código'): Promise<ResultadoLectura> {
    try {
      const permiso = await BarcodeScanner.requestPermissions();
      if (permiso.camera !== 'granted' && permiso.camera !== 'limited') {
        return {
          ok: false,
          mensaje: `Necesitamos permiso de cámara para escanear ${queSeEscanea}. Habilitalo en la configuración del dispositivo.`,
        };
      }

      const disponible = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!disponible.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      const resultado = await BarcodeScanner.scan({ formats: formatos });

      if (!resultado.barcodes.length) {
        return { ok: false, cancelado: true };
      }

      return { ok: true, texto: (resultado.barcodes[0].rawValue ?? '').trim() };
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);
      if (/cancel/i.test(mensaje)) {
        return { ok: false, cancelado: true };
      }
      return { ok: false, mensaje: `No se pudo escanear ${queSeEscanea}. Probá de nuevo.` };
    }
  }

  /**
   * Escanea un QR y valida que sea exactamente el de ingreso al local
   * (CONTENIDO_QR_INGRESO). No sirve cualquier QR — tiene que ser ese.
   */
  async escanearQrIngreso(): Promise<ResultadoEscaneoQr> {
    const lectura = await this.escanear([BarcodeFormat.QrCode]);
    if (!lectura.ok) return lectura;

    if (lectura.texto !== CONTENIDO_QR_INGRESO) {
      return { ok: false, mensaje: 'Ese código QR no corresponde a la entrada del local.' };
    }
    return { ok: true };
  }

  /** Escanea el QR de una mesa y devuelve su id (ver contenidoQrMesa / leerIdMesa). */
  async escanearQrMesa(): Promise<ResultadoEscaneoMesa> {
    const lectura = await this.escanear([BarcodeFormat.QrCode]);
    if (!lectura.ok) return lectura;

    const mesaId = leerIdMesa(lectura.texto);
    if (!mesaId) {
      return { ok: false, mensaje: 'Ese código QR no corresponde a una mesa.' };
    }
    return { ok: true, mesaId };
  }
}
