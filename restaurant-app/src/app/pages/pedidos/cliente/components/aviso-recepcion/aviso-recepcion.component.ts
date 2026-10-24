import { Component, Input, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IonButton } from '@ionic/angular/standalone';
import { PedidosService } from '../../../../../core/services/pedidos.service';
import { AvisosService } from '../../../../../core/services/avisos.service';
import { NotificacionesService } from '../../../../../core/services/notificaciones.service';

/** Rol con que se cierra el modal cuando el cliente confirmó la recepción. */
export const ROL_RECEPCION_CONFIRMADA = 'confirmada';
/** Rol con que se cierra cuando el cliente avisó que todavía no lo recibió. */
export const ROL_RECEPCION_RECHAZADA = 'no-recibido';

/**
 * Cartel que le pide al cliente confirmar que recibió su pedido (punto 19).
 * Lo abre siempre AvisoRecepcionService. «Todavía no lo recibí» devuelve el
 * pedido al mozo (vuelve a «listo para entregar») y le avisa por push.
 */
@Component({
  selector: 'app-aviso-recepcion',
  standalone: true,
  imports: [IonButton],
  templateUrl: './aviso-recepcion.component.html',
  styleUrls: ['./aviso-recepcion.component.scss'],
})
export class AvisoRecepcionComponent {
  private readonly modalController = inject(ModalController);
  private readonly pedidos = inject(PedidosService);
  private readonly avisos = inject(AvisosService);
  private readonly notificaciones = inject(NotificacionesService);

  @Input({ required: true }) pedidoId!: string;
  @Input({ required: true }) numeroMesa!: number;

  readonly confirmando = signal(false);

  async confirmar(): Promise<void> {
    if (this.confirmando()) return;
    this.confirmando.set(true);
    try {
      const resultado = await this.pedidos.confirmarRecepcion(this.pedidoId);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo confirmar la recepción. Probá de nuevo.');
        return;
      }
      await this.modalController.dismiss(null, ROL_RECEPCION_CONFIRMADA);
      await this.avisos.exito('¡Gracias! Confirmaste la recepción de tu pedido.');
    } finally {
      this.confirmando.set(false);
    }
  }

  /** «Todavía no lo recibí»: el pedido vuelve al mozo y se le avisa por push. */
  async noRecibido(): Promise<void> {
    if (this.confirmando()) return;
    this.confirmando.set(true);
    try {
      const resultado = await this.pedidos.rechazarRecepcion(this.pedidoId);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo avisar al mozo. Probá de nuevo.');
        return;
      }
      if (resultado.numeroMesa !== undefined) {
        this.notificaciones.avisarPedidoNoRecibido(resultado.numeroMesa);
      }
      await this.modalController.dismiss(null, ROL_RECEPCION_RECHAZADA);
      await this.avisos.exito('Le avisamos al mozo que todavía no recibiste tu pedido.');
    } finally {
      this.confirmando.set(false);
    }
  }
}
