import { Injectable, inject } from '@angular/core';
// De @ionic/angular (no de /standalone): igual que AvisoRechazoService.
import { ModalController } from '@ionic/angular';
import { Pedido } from '../../../../../core/models/pedido.model';
import { PedidosService } from '../../../../../core/services/pedidos.service';
import { ClienteActualService } from '../../../../../core/services/cliente-actual.service';
import { SolicitudesMesaService } from '../../../../../core/services/solicitudes-mesa.service';

/**
 * Le pide al cliente que confirme la recepción de su pedido (punto 19), con
 * el modal de AvisoRecepcionComponent. Es el único lugar que lo abre, así
 * nunca hay dos a la vez. Lo usan:
 *  - vigilar(): al arrancar la app mira si el pedido ya está esperando la
 *    confirmación (por ejemplo, el cliente tocó la push con la app cerrada)
 *    y escucha por Realtime para abrirlo apenas el mozo entrega, en
 *    cualquier pantalla.
 *  - «Estado de mi pedido», cada vez que el cliente entra.
 *
 * Con la app cerrada o en segundo plano, el aviso es la push, que abre
 * «Estado de mi pedido».
 */
@Injectable({ providedIn: 'root' })
export class AvisoRecepcionService {
  private readonly modalController = inject(ModalController);
  private readonly pedidos = inject(PedidosService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);

  private abierto = false;
  private vigilando: { solicitudId: string; dejarDeEscuchar: () => void } | null = null;

  async vigilar(): Promise<void> {
    try {
      const clienteId = await this.clienteActual.obtenerClienteIdActual();
      const solicitud = clienteId ? await this.solicitudesMesa.obtenerMiSolicitud(clienteId) : null;

      if (!clienteId || solicitud?.estado !== 'vinculado') {
        this.dejarDeVigilar();
        return;
      }
      if (this.vigilando?.solicitudId === solicitud.id) return;

      this.dejarDeVigilar();
      this.vigilando = {
        solicitudId: solicitud.id,
        dejarDeEscuchar: this.pedidos.suscribirseAPedidoDeEstadia(solicitud.id, (pedido) => {
          if (pedido) void this.mostrar(pedido);
        }),
      };

      // El mozo pudo entregar mientras la app estaba cerrada.
      const actual = await this.pedidos.obtenerMiPedidoActivo(clienteId);
      if (actual.ok && actual.dato) void this.mostrar(actual.dato);
    } catch (error) {
      console.error('Error vigilando la entrega del pedido:', error);
    }
  }

  dejarDeVigilar(): void {
    this.vigilando?.dejarDeEscuchar();
    this.vigilando = null;
  }

  /** Abre la confirmación, salvo que ya haya una abierta o el pedido no la necesite. */
  async mostrar(pedido: Pedido): Promise<void> {
    if (this.abierto || pedido.estado !== 'pendiente_recepcion') return;
    this.abierto = true;

    try {
      // Solo se le pregunta al dueño del pedido (el celular pudo cambiar de dueño).
      const clienteId = await this.clienteActual.obtenerClienteIdActual();
      if (clienteId !== pedido.clienteId) return;

      // import() dinámico por la misma razón que en AvisoRechazoService.
      const { AvisoRecepcionComponent } = await import('./aviso-recepcion.component');
      const modal = await this.modalController.create({
        component: AvisoRecepcionComponent,
        componentProps: { pedidoId: pedido.id, numeroMesa: pedido.numeroMesa },
        cssClass: 'aviso-recepcion-modal',
      });
      await modal.present();
      await modal.onDidDismiss();
    } catch (error) {
      console.error('Error mostrando la confirmación de recepción:', error);
    } finally {
      this.abierto = false;
    }
  }
}
