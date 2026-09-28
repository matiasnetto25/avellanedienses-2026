import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Haptics, NotificationType } from '@capacitor/haptics';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  informationCircleOutline,
} from 'ionicons/icons';

export type TipoAviso = 'exito' | 'error' | 'advertencia' | 'info';

/** Tono de estado de la guía (§7.10): define el color del borde y del ícono. */
type TonoAviso = 'listo' | 'en-curso' | 'espera' | 'rechazo';

@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly toastController = inject(ToastController);

  private readonly estiloPorTipo: Record<TipoAviso, { tono: TonoAviso; icono: string }> = {
    exito: { tono: 'listo', icono: 'checkmark-circle-outline' },
    info: { tono: 'en-curso', icono: 'information-circle-outline' },
    advertencia: { tono: 'espera', icono: 'alert-circle-outline' },
    error: { tono: 'rechazo', icono: 'close-circle-outline' },
  };

  /** El toast visible: se cierra antes de mostrar otro, para que no se apilen. */
  private toastActual?: HTMLIonToastElement;

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline, closeCircleOutline, informationCircleOutline });
  }

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
    const { tono, icono } = this.estiloPorTipo[tipo];
    const toast = await this.toastController.create({
      message: mensaje,
      duration: duracionMs,
      // Siempre arriba: abajo taparía la acción principal fija.
      position: 'top',
      positionAnchor: this.barraSuperiorVisible(),
      icon: icono,
      cssClass: ['aviso-toast', `aviso-toast--${tono}`],
    });

    const anterior = this.toastActual;
    this.toastActual = toast;
    await anterior?.dismiss().catch(() => undefined);
    await toast.present();
  }

  /**
   * El ion-header de la pantalla que se está viendo, para que el toast salga
   * debajo y no tape el título. Si la pantalla no tiene barra superior, el
   * toast va arriba de todo (Ionic ya deja libre la barra de estado).
   */
  private barraSuperiorVisible(): HTMLElement | undefined {
    const headers = Array.from(document.querySelectorAll<HTMLElement>('ion-header'));
    return headers
      .filter((header) => !header.closest('.ion-page-hidden') && header.getBoundingClientRect().height > 0)
      .pop();
  }
}
