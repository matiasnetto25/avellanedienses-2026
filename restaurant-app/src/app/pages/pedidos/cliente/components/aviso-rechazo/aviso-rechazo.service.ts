import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
// De @ionic/angular (no de /standalone): el servicio es de la raíz y la app
// arranca con AppModule, igual que ToastController en AvisosService.
import { ModalController } from '@ionic/angular';
import { Pedido } from '../../../../../core/models/pedido.model';
import { PedidosService } from '../../../../../core/services/pedidos.service';
import { ClienteActualService } from '../../../../../core/services/cliente-actual.service';
import { SolicitudesMesaService } from '../../../../../core/services/solicitudes-mesa.service';

/** Rol con que AvisoRechazoComponent cierra el modal cuando el cliente elige modificar. */
export const ROL_MODIFICAR_PEDIDO = 'modificar';

/**
 * Avisa al cliente que el mozo rechazó su pedido (punto 13), con el modal
 * de AvisoRechazoComponent. Es el único lugar que lo abre, así nunca hay
 * dos a la vez. Lo usan:
 *  - «Estado de mi pedido», cada vez que el cliente entra y el pedido está
 *    rechazado.
 *  - vigilar(): escucha por Realtime el pedido de la estadía del cliente y
 *    abre el modal apenas el mozo lo rechaza, en cualquier pantalla.
 *
 * Con la app cerrada o en segundo plano, el aviso es la push (issue 05),
 * que abre «Estado de mi pedido».
 */
@Injectable({ providedIn: 'root' })
export class AvisoRechazoService {
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);
  private readonly pedidos = inject(PedidosService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);

  /** true mientras el modal está abierto (o abriéndose). */
  private abierto = false;
  /** Estadía que se está vigilando y la función que corta la suscripción. */
  private vigilando: { solicitudId: string; dejarDeEscuchar: () => void } | null = null;

  /**
   * Empieza a escuchar el pedido de la estadía del cliente actual. Se
   * llama al arrancar la app y al entrar a la pantalla de la mesa (después
   * de vincularse); si ya vigila esa estadía, no hace nada.
   */
  async vigilar(): Promise<void> {
    try {
      const clienteId = await this.clienteActual.obtenerClienteIdActual();
      const solicitud = clienteId ? await this.solicitudesMesa.obtenerMiSolicitud(clienteId) : null;

      if (solicitud?.estado !== 'vinculado') {
        this.dejarDeVigilar();
        return;
      }
      if (this.vigilando?.solicitudId === solicitud.id) return;

      this.dejarDeVigilar();
      this.vigilando = {
        solicitudId: solicitud.id,
        dejarDeEscuchar: this.pedidos.suscribirseAPedidoDeEstadia(solicitud.id, (pedido) => {
          if (pedido?.estado === 'rechazado') void this.mostrar(pedido);
        }),
      };
    } catch (error) {
      console.error('Error vigilando el pedido del cliente:', error);
    }
  }

  dejarDeVigilar(): void {
    this.vigilando?.dejarDeEscuchar();
    this.vigilando = null;
  }

  /** Abre el aviso del pedido rechazado, salvo que ya haya uno abierto. */
  async mostrar(pedido: Pedido): Promise<void> {
    if (this.abierto || pedido.estado !== 'rechazado') return;
    this.abierto = true;

    try {
      // El celular pudo cambiar de dueño (otro cliente inició sesión) con
      // la suscripción de antes todavía abierta: solo se avisa al dueño.
      const clienteId = await this.clienteActual.obtenerClienteIdActual();
      if (clienteId !== pedido.clienteId) return;

      // El componente se carga recién acá, con import(): este servicio lo usa
      // AppComponent al arrancar, y si el componente (que usa componentes
      // standalone de Ionic) entrara en el arranque, Ionic se inicializaría
      // antes de tiempo y toda la app quedaría sin estilos (modo «undefined»).
      const { AvisoRechazoComponent } = await import('./aviso-rechazo.component');
      const modal = await this.modalController.create({
        component: AvisoRechazoComponent,
        componentProps: { numeroMesa: pedido.numeroMesa, motivo: pedido.motivoRechazo ?? '' },
        cssClass: 'aviso-rechazo-modal',
      });
      await modal.present();

      const { role } = await modal.onDidDismiss();
      if (role === ROL_MODIFICAR_PEDIDO) {
        await this.router.navigate(['/mesa', pedido.mesaId, 'pedido'], {
          queryParams: { mesa: pedido.numeroMesa },
        });
      }
    } catch (error) {
      console.error('Error mostrando el aviso de pedido rechazado:', error);
    } finally {
      this.abierto = false;
    }
  }
}
