import { Injectable, inject } from '@angular/core';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly toastController = inject(ToastController);

  async error(mensaje: string): Promise<void> {
    // En navegador de escritorio la API de vibración no siempre existe (rechaza la promesa); se
    // ignora ese rechazo para no romper la ejecución fuera de un dispositivo/emulador real.
    Haptics.notification({ type: NotificationType.Error }).catch(() => undefined);

    const toast = await this.toastController.create({
      message: mensaje,
      duration: 2500,
      position: 'bottom',
      color: 'danger',
    });
    await toast.present();
  }
}
