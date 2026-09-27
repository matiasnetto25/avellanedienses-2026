import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Haptics, NotificationType } from '@capacitor/haptics';

export type TipoAviso = 'exito' | 'error' | 'advertencia' | 'info';

@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly toastController = inject(ToastController);

  private readonly colorPorTipo: Record<TipoAviso, string> = {
    exito: 'success',
    error: 'danger',
    advertencia: 'warning',
    info: 'medium',
  };

  async error(mensaje: string, duracionMs = 3000): Promise<void> {
    await this.vibrarError();
    await this.mostrar(mensaje, 'error', duracionMs);
  }

  async exito(mensaje: string, duracionMs = 2200): Promise<void> {
    await this.mostrar(mensaje, 'exito', duracionMs);
  }

  async advertencia(mensaje: string, duracionMs = 2600): Promise<void> {
    await this.mostrar(mensaje, 'advertencia', duracionMs);
  }

  async info(mensaje: string, duracionMs = 2000): Promise<void> {
    await this.mostrar(mensaje, 'info', duracionMs);
  }

  /** Aviso único para los botones de funciones que todavía no están disponibles. */
  async proximamente(): Promise<void> {
    await this.info('Esta función se habilita en la próxima entrega.');
  }

  private async vibrarError(): Promise<void> {
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // Sin soporte de haptics (ej: corriendo en navegador de escritorio) — ignorar.
    }
  }

  private async mostrar(mensaje: string, tipo: TipoAviso, duracionMs: number): Promise<void> {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: duracionMs,
      position: 'bottom',
      color: this.colorPorTipo[tipo],
      cssClass: 'aviso-toast',
    });
    await toast.present();
  }
}
