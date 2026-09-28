import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { MotivoRechazoComponent } from '../components/motivo-rechazo/motivo-rechazo.component';
import { Pedido } from '../../../../core/models/pedido.model';
import { PedidosService } from '../../../../core/services/pedidos.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';

@Component({
  selector: 'app-pedidos-pendientes',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
    IonHeader,
    IonModal,
    IonTitle,
    IonToolbar,
    MotivoRechazoComponent,
  ],
  templateUrl: './pedidos-pendientes.page.html',
  styleUrls: ['./pedidos-pendientes.page.scss'],
})
export class PedidosPendientesPage implements OnInit, OnDestroy {
  private readonly pedidosService = inject(PedidosService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly pedidos = signal<Pedido[]>([]);
  /** Pedido que se está rechazando: deshabilita sus botones (evita el doble toque). */
  readonly procesandoId = signal<string | null>(null);
  /** Pedido cuyo motivo de rechazo se está pidiendo; null con el modal cerrado. */
  readonly pedidoARechazar = signal<Pedido | null>(null);

  private dejarDeEscuchar: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      await this.cargar();
      // Un pedido nuevo, o uno que otro mozo confirmó o rechazó: se relee la
      // lista entera (la consulta ya filtra y ordena).
      this.dejarDeEscuchar = this.pedidosService.suscribirseAPedidos(() => this.cargar());
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  /** Al volver a la pantalla (Ionic la deja guardada en la pila), refresca. */
  async ionViewWillEnter(): Promise<void> {
    if (!this.cargando()) await this.cargar();
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar?.();
  }

  private async cargar(): Promise<void> {
    const pedidos = await this.pedidosService.listarPendientesConfirmacion();
    if (pedidos === null) {
      // Si ya había una lista, se deja la que estaba: el próximo cambio la refresca.
      if (this.pedidos().length === 0) this.errorCarga.set(true);
      await this.avisos.error('No se pudieron cargar los pedidos. Probá de nuevo.');
      return;
    }
    this.errorCarga.set(false);
    this.pedidos.set(pedidos);
  }

  async reintentar(): Promise<void> {
    await this.loading.envolver(this.cargar());
  }

  pedirMotivoRechazo(pedido: Pedido): void {
    if (!this.procesandoId()) this.pedidoARechazar.set(pedido);
  }

  /** «Cancelar» o tocar fuera del modal: no cambia nada. */
  cerrarMotivoRechazo(): void {
    if (!this.procesandoId()) this.pedidoARechazar.set(null);
  }

  /**
   * El modal ya validó el motivo. Se cierra siempre al terminar: si salió
   * bien, el pedido ya no está en la lista; si falló, lo más probable es
   * que otro mozo ya lo haya confirmado o rechazado.
   */
  async rechazar(pedido: Pedido, motivo: string): Promise<void> {
    this.procesandoId.set(pedido.id);
    this.loading.mostrar();
    try {
      const resultado = await this.pedidosService.rechazar(pedido.id, motivo);
      this.cerrarModalTrasProcesar();
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo rechazar el pedido.');
        await this.cargar();
        return;
      }
      // Se saca ya, sin esperar a Realtime (tarda uno o dos segundos en
      // releer la lista); a los demás mozos les desaparece por Realtime.
      this.pedidos.update((lista) => lista.filter((p) => p.id !== pedido.id));
      // Sin await: la push no bloquea, y si falla el rechazo igual quedó hecho.
      if (resultado.clienteId && resultado.mesaId) {
        this.notificaciones.avisarPedidoRechazado(resultado.clienteId, resultado.mesaId, motivo.trim());
      }
      await this.avisos.exito('Pedido rechazado. El cliente ya puede modificarlo.');
    } finally {
      this.procesandoId.set(null);
      this.loading.ocultar();
    }
  }

  /**
   * Primero baja «procesando»: mientras está activo, [canDismiss] no deja
   * cerrar el modal (igual que el resumen del pedido en armar-pedido).
   */
  private cerrarModalTrasProcesar(): void {
    this.procesandoId.set(null);
    this.pedidoARechazar.set(null);
  }
}
