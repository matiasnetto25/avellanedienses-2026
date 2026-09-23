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

export interface ResultadoEscaneoQr {
  ok: boolean;
  cancelado?: boolean;
  mensaje?: string;
}

/** Error de escaneo, sin el valor leído (todavía no se pudo leer nada útil). */
interface ErrorEscaneo {
  ok: false;
  cancelado?: boolean;
  mensaje?: string;
}

/** Éxito: se leyó algo, sin validar todavía a qué corresponde. */
interface ExitoEscaneoCrudo {
  ok: true;
  raw: string;
}

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
   * Abre la cámara y devuelve el texto crudo leído, o el motivo por el
   * que no se pudo (permiso denegado, cancelado, etc.) — sin validar
   * todavía a qué corresponde ese contenido, eso lo hace cada caller.
   */
  private async escanearCrudo(): Promise<ExitoEscaneoCrudo | ErrorEscaneo> {
    try {
      const permiso = await BarcodeScanner.requestPermissions();
      if (permiso.camera !== 'granted' && permiso.camera !== 'limited') {
        return {
          ok: false,
          mensaje: 'Necesitamos permiso de cámara para escanear el código. Habilitalo en la configuración del dispositivo.',
        };
      }

      const disponible = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!disponible.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }

      const resultado = await BarcodeScanner.scan({
        formats: [BarcodeFormat.QrCode],
      });

      if (!resultado.barcodes.length) {
        return { ok: false, cancelado: true };
      }

      return { ok: true, raw: (resultado.barcodes[0].rawValue ?? '').trim() };
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);
      if (/cancel/i.test(mensaje)) {
        return { ok: false, cancelado: true };
      }
      return { ok: false, mensaje: 'No se pudo escanear el código. Probá de nuevo.' };
    }
  }

  /**
   * Escanea un QR y valida que sea exactamente el de ingreso al local
   * (CONTENIDO_QR_INGRESO). No sirve cualquier QR — tiene que ser ese.
   */
  async escanearQrIngreso(): Promise<ResultadoEscaneoQr> {
    const resultado = await this.escanearCrudo();
    if (!resultado.ok) return resultado;

    if (resultado.raw !== CONTENIDO_QR_INGRESO) {
      return { ok: false, mensaje: 'Ese código QR no corresponde a la entrada del local.' };
    }
    return { ok: true };
  }
}