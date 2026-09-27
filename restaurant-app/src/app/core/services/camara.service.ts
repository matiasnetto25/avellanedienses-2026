import { Injectable, inject, signal } from '@angular/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AlertController } from '@ionic/angular';
import { AvisosService } from './avisos.service';

export interface ResultadoFoto {
  ok: boolean;
  dataUrl?: string;
  cancelado?: boolean;
  mensaje?: string;
}

/**
 * Servicio único de cámara para toda la app.
 */
@Injectable({ providedIn: 'root' })
export class CamaraService {
  private readonly alertController = inject(AlertController);
  private readonly avisos = inject(AvisosService);

  private readonly _abriendo = signal(false);
  /** true mientras la cámara o la galería están abiertas: sirve para
   *  deshabilitar el botón y mostrar «Abriendo cámara…». */
  readonly abriendo = this._abriendo.asReadonly();

  /**
   * Lo que usan los formularios: saca la foto con la cámara y devuelve su
   * dataUrl. Si el usuario cancela devuelve null sin aviso; si falla (o no
   * hay permiso), muestra el error con vibración y devuelve null. Un
   * segundo toque mientras la cámara está abierta no hace nada.
   */
  tomarFotoConAviso(): Promise<string | null> {
    return this.conAviso(() => this.tomarFoto());
  }

  /** Igual que tomarFotoConAviso(), pero deja elegir cámara o galería. */
  seleccionarFotoConAviso(): Promise<string | null> {
    return this.conAviso(() => this.seleccionarFoto());
  }

  private async conAviso(obtener: () => Promise<ResultadoFoto>): Promise<string | null> {
    if (this._abriendo()) return null;
    this._abriendo.set(true);
    try {
      const resultado = await obtener();
      if (resultado.ok && resultado.dataUrl) {
        return resultado.dataUrl;
      }
      if (!resultado.cancelado) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo tomar la foto.');
      }
      return null;
    } finally {
      this._abriendo.set(false);
    }
  }

  /** Fuerza cámara únicamente — usar para foto de empleado, mesa y DNI. */
  async tomarFoto(): Promise<ResultadoFoto> {
    return this.obtenerFoto(CameraSource.Camera);
  }

  /**
   * A diferencia de tomarFoto(), acá SÍ se permite elegir entre cámara o
   * galería — usar solo donde se pida explícitamente (alta de platos/
   * bebidas). Para empleado/mesa/DNI seguir usando tomarFoto().
   *
   * IMPORTANTE: a partir de @capacitor/camera v6+, el plugin sacó por
   * completo el prompt nativo (CameraSource.Prompt ya no existe como
   * diálogo propio — la doc oficial dice "build the prompt using your
   * own UI"). Se usa un ion-alert (con cssClass 'merlot-alert', el
   * mismo mecanismo ya probado para el resto de los alerts de la app)
   * en vez de un ActionSheet — el ActionSheet tiene su propio sistema
   * de tematización, más limitado, y terminaba sin verse con estilo
   * propio pese a estar bien configurado.
   */
  async seleccionarFoto(): Promise<ResultadoFoto> {
    const fuente = await this.elegirFuente();
    if (fuente === null) {
      return { ok: false, cancelado: true };
    }
    return this.obtenerFoto(fuente);
  }

  private async elegirFuente(): Promise<CameraSource.Camera | CameraSource.Photos | null> {
    return new Promise((resolve) => {
      let resuelto = false;

      this.alertController
        .create({
          header: 'Foto',
          message: '¿Cómo querés agregar la foto?',
          cssClass: 'merlot-alert',
          buttons: [
            {
              text: 'Tomar foto',
              handler: () => {
                resuelto = true;
                resolve(CameraSource.Camera);
              },
            },
            {
              text: 'Elegir de la galería',
              handler: () => {
                resuelto = true;
                resolve(CameraSource.Photos);
              },
            },
            {
              text: 'Cancelar',
              role: 'cancel',
              handler: () => {
                resuelto = true;
                resolve(null);
              },
            },
          ],
        })
        .then((alert) => {
          alert.onDidDismiss().then(() => {
            if (!resuelto) resolve(null);
          });
          alert.present();
        });
    });
  }

  private async obtenerFoto(source: CameraSource): Promise<ResultadoFoto> {
    try {
      const foto = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source,
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