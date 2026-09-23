import { Injectable } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

export interface ResultadoFoto {
  ok: boolean;
  dataUrl?: string;
  cancelado?: boolean;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class CamaraService {
  /** Fuerza cámara únicamente — usar para foto de empleado, mesa y DNI. */
  async tomarFoto(): Promise<ResultadoFoto> {
    try {
      const foto = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (!foto.dataUrl) {
        return { ok: false, mensaje: 'No se pudo procesar la fotografía tomada.' };
      }

      return { ok: true, dataUrl: foto.dataUrl };
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);

      if (/cancel/i.test(mensaje)) {
        return { ok: false, cancelado: true };
      }
      if (/permission/i.test(mensaje)) {
        return {
          ok: false,
          mensaje: 'Necesitamos permiso de cámara para continuar. Habilitalo en la configuración del dispositivo.',
        };
      }
      return { ok: false, mensaje: 'No se pudo abrir la cámara. Probá de nuevo.' };
    }
  }

  async seleccionarFoto(): Promise<ResultadoFoto> {
    try {
      const foto = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
      });

      if (!foto.dataUrl) {
        return { ok: false, mensaje: 'No se pudo procesar la imagen.' };
      }

      return { ok: true, dataUrl: foto.dataUrl };
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : String(error);

      if (/cancel/i.test(mensaje)) {
        return { ok: false, cancelado: true };
      }
      if (/permission/i.test(mensaje)) {
        return {
          ok: false,
          mensaje: 'Necesitamos permiso de cámara/galería para continuar. Habilitalo en la configuración del dispositivo.',
        };
      }
      return { ok: false, mensaje: 'No se pudo obtener la imagen. Probá de nuevo.' };
    }
  }
}