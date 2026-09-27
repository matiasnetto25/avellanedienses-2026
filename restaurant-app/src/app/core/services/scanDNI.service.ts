import { Injectable, inject } from '@angular/core';
import { BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { QrService } from './qr.service';
import { DniQrData, Sexo } from '../models/empleado.model';
import { calcularCuilSugerido } from '../../validators/empleado.validators';

export interface ResultadoEscaneoDni {
  ok: boolean;
  datos?: DniQrData;
  cancelado?: boolean;
  mensaje?: string;
}
 
/**
 * El DNI argentino (desde 2012) trae en el dorso un código de barras PDF417
 * (no es técnicamente un "QR", aunque coloquialmente se lo llame así) con
 * los campos separados por "@" en este orden:
 *   1) número de trámite
 *   2) apellido
 *   3) nombre
 *   4) sexo (M/F)
 *   5) número de documento
 *   6) ejemplar (A/B/C...)
 *   7) fecha de nacimiento (dd/mm/aaaa)
 *   8) fecha de emisión (dd/mm/aaaa)
 *
 * Por eso el scanner pide explícitamente los formatos QrCode Y Pdf417: así
 * funciona tanto si escanean el frente (a veces trae QR) como el dorso.
 */
@Injectable({ providedIn: 'root' })
export class DniScannerService {
  private readonly qr = inject(QrService);

  /** Lee el DNI con el escaneo común de QrService y lo interpreta. */
  async escanear(): Promise<ResultadoEscaneoDni> {
    const lectura = await this.qr.escanear([BarcodeFormat.QrCode, BarcodeFormat.Pdf417], 'el DNI');
    if (!lectura.ok) return lectura;

    const datos = this.parsearDniArgentino(lectura.texto);
    if (!datos) {
      return {
        ok: false,
        mensaje: 'No pudimos leer los datos del DNI. Probá escanear el código de barras del dorso, con buena luz.',
      };
    }

    return { ok: true, datos };
  }
 
  private parsearDniArgentino(raw: string): DniQrData | null {
    const partes = raw.split('@').map((p) => p.trim());
    if (partes.length < 7) {
      return null; // no tiene la forma esperada del DNI argentino
    }
 
    const [tramite, apellido, nombre, sexoCrudo, dni, , fechaNacCruda, fechaEmiCruda] = partes;
 
    const sexo: Sexo = sexoCrudo === 'M' ? 'masculino' : sexoCrudo === 'F' ? 'femenino' : 'otros';
 
    const fechaNacimiento = this.convertirFecha(fechaNacCruda);
    const fechaEmision = fechaEmiCruda ? this.convertirFecha(fechaEmiCruda) : undefined;
 
    const cuilSugerido = dni ? calcularCuilSugerido(dni, sexo === 'femenino') ?? undefined : undefined;
 
    return {
      tramite,
      apellido,
      nombre,
      sexo,
      dni,
      cuilSugerido,
      fechaNacimiento,
      fechaEmision,
    };
  }
 
  /** Convierte "dd/mm/aaaa" a "aaaa-mm-dd" (formato que entiende <ion-input type="date">) */
  private convertirFecha(fechaDdMmAaaa: string): string | undefined {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(fechaDdMmAaaa);
    if (!match) return undefined;
    const [, dd, mm, aaaa] = match;
    return `${aaaa}-${mm}-${dd}`;
  }
}