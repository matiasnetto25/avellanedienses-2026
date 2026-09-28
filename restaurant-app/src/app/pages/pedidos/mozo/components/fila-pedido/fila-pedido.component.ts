import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { IonButton, IonModal } from '@ionic/angular/standalone';
import { MotivoRechazoComponent } from '../motivo-rechazo/motivo-rechazo.component';
import { ChipEstadoComponent } from '../../../../../shared/components/chip-estado/chip-estado.component';
import { Pedido } from '../../../../../core/models/pedido.model';
import { PedidosService } from '../../../../../core/services/pedidos.service';
import { ResumenMozoService } from '../../../../../core/services/resumen-mozo.service';
import { AvisosService } from '../../../../../core/services/avisos.service';
import { LoadingService } from '../../../../../core/services/loading.service';
import { NotificacionesService } from '../../../../../core/services/notificaciones.service';
import { estadoPedido } from '../../../../../core/utils/estado-visual';
import { relojPorMinuto, tiempoRelativo } from '../../../../../core/utils/tiempo-relativo';

/** Fila compacta de un pedido por confirmar, con Confirmar y Rechazar. La usan Ahora y Pedidos del mozo. */
@Component({
  selector: 'app-fila-pedido',
  standalone: true,
  imports: [DecimalPipe, IonButton, IonModal, ChipEstadoComponent, MotivoRechazoComponent],
  templateUrl: './fila-pedido.component.html',
  styleUrls: ['./fila-pedido.component.scss'],
})
export class FilaPedidoComponent {
  private readonly pedidosService = inject(PedidosService);
  private readonly resumen = inject(ResumenMozoService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly pedido = input.required<Pedido>();
  /** Muestra los productos y el tiempo de preparación (pestaña Pedidos). */
  readonly conDetalle = input(false);

  readonly procesando = signal(false);
  readonly pidiendoMotivo = signal(false);

  private readonly ahora = relojPorMinuto();
  readonly estado = computed(() => estadoPedido(this.pedido().estado));
  readonly cantidadProductos = computed(() => {
    const cantidad = this.pedido().items.reduce((suma, item) => suma + item.cantidad, 0);
    return cantidad === 1 ? '1 producto' : `${cantidad} productos`;
  });
  readonly hace = computed(() => tiempoRelativo(this.pedido().creadoEn, this.ahora()));

  async confirmar(): Promise<void> {
    if (this.procesando()) return;
    const pedido = this.pedido();
    this.procesando.set(true);
    this.loading.mostrar();
    try {
      const resultado = await this.pedidosService.confirmar(pedido.id);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo confirmar el pedido. Probá de nuevo.');
        await this.resumen.recargarPedidos();
        return;
      }
      this.resumen.quitarPedido(pedido.id);
      if (resultado.numeroMesa !== undefined && resultado.sectores) {
        this.notificaciones.avisarPedidoDerivado(resultado.numeroMesa, resultado.sectores);
      }
      if (resultado.clienteId && resultado.mesaId) {
        this.notificaciones.avisarPedidoConfirmado(resultado.clienteId, resultado.mesaId);
      }
      await this.avisos.exito(`Pedido de la Mesa ${pedido.numeroMesa} confirmado y enviado a preparar.`);
    } finally {
      this.procesando.set(false);
      this.loading.ocultar();
    }
  }

  pedirMotivo(): void {
    if (!this.procesando()) this.pidiendoMotivo.set(true);
  }

  cerrarMotivo(): void {
    if (!this.procesando()) this.pidiendoMotivo.set(false);
  }

  async rechazar(motivo: string): Promise<void> {
    const pedido = this.pedido();
    this.procesando.set(true);
    this.loading.mostrar();
    try {
      const resultado = await this.pedidosService.rechazar(pedido.id, motivo);
      // Primero baja «procesando»: mientras está activo, [canDismiss] no deja cerrar el modal.
      this.procesando.set(false);
      this.pidiendoMotivo.set(false);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo rechazar el pedido. Probá de nuevo.');
        await this.resumen.recargarPedidos();
        return;
      }
      this.resumen.quitarPedido(pedido.id);
      if (resultado.clienteId && resultado.mesaId) {
        this.notificaciones.avisarPedidoRechazado(resultado.clienteId, resultado.mesaId, motivo.trim());
      }
      await this.avisos.exito('Pedido rechazado. El cliente ya puede modificarlo.');
    } finally {
      this.procesando.set(false);
      this.loading.ocultar();
    }
  }
}
