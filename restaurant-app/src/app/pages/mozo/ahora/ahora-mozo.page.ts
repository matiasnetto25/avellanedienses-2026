
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonButton, IonContent, IonIcon } from '@ionic/angular/standalone';
// De @ionic/angular (no de /standalone): igual que ModalController en los avisos.
import { AlertController } from '@ionic/angular';

import { Pedido, nombreMedioPago } from '../../../core/models/pedido.model';
import { ConversacionActiva } from '../../../core/models/consulta.model';
import { LoadingService } from '../../../core/services/loading.service';
import {
  PerfilActual,
  PerfilActualService,
} from '../../../core/services/perfil-actual.service';
import { ResumenMozoService } from '../../../core/services/resumen-mozo.service';

import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { FilaPedidoComponent } from '../../pedidos/mozo/components/fila-pedido/fila-pedido.component';

const FILAS_POR_BLOQUE = 3;

@Component({
  selector: 'app-ahora-mozo',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    IonButton,
    IonContent,
    IonIcon,
    AlturaDisponibleDirective,
    EncabezadoPerfilComponent,
    EstadoVacioComponent,
    FilaPedidoComponent,
  ],
  templateUrl: './ahora-mozo.page.html',
  styleUrls: ['./ahora-mozo.page.scss'],
})
export class AhoraMozoPage implements OnInit {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly resumenMozo = inject(ResumenMozoService);
  private readonly alertController = inject(AlertController);

  /** La cuenta (pedido) que se está rechazando o confirmando: evita el doble toque. */
  readonly procesandoCuentaId = signal<string | null>(null);

  readonly cargando = signal(true);
  readonly perfil = signal<PerfilActual | null>(null);

  // Evita enviar varias solicitudes de entrega simultáneamente.
  readonly entregandoPedidoId = signal<string | null>(null);

  // Pedidos nuevos que esperan confirmación del mozo.
  readonly porConfirmar = this.resumenMozo.porConfirmar;

  readonly pedidos = computed(() =>
    this.resumenMozo.pedidos().slice(0, FILAS_POR_BLOQUE)
  );

  // Pedidos confirmados cuyos productos ya están todos listos.
  readonly cantidadListos = this.resumenMozo.cantidadListosParaEntregar;

  readonly pedidosListos = computed(() =>
    this.resumenMozo.pedidosListos().slice(0, FILAS_POR_BLOQUE)
  );

  // Pedidos entregados que esperan la confirmación del cliente (punto 19).
  readonly cantidadEsperandoRecepcion = computed(
    () => this.resumenMozo.pedidosEsperandoRecepcion().length
  );

  readonly pedidosEsperandoRecepcion = computed(() =>
    this.resumenMozo.pedidosEsperandoRecepcion().slice(0, FILAS_POR_BLOQUE)
  );

  readonly nombreMedioPago = nombreMedioPago;

  // Mesas que pidieron la cuenta (punto 21).
  readonly cantidadCuentasPedidas = computed(
    () => this.resumenMozo.cuentasPedidas().length
  );

  readonly cuentasPedidas = computed(() =>
    this.resumenMozo.cuentasPedidas().slice(0, FILAS_POR_BLOQUE)
  );

  // Consultas de clientes que esperan respuesta.
  readonly consultasSinResponder =
    this.resumenMozo.consultasSinResponder;

  readonly consultas = computed(() =>
    this.resumenMozo.sinResponder().slice(0, FILAS_POR_BLOQUE)
  );

  readonly todoEnOrden = computed(
    () =>
      this.porConfirmar() === 0 &&
      this.consultasSinResponder() === 0 &&
      this.cantidadListos() === 0 &&
      this.cantidadEsperandoRecepcion() === 0 &&
      this.cantidadCuentasPedidas() === 0
  );

  readonly resumen = computed(() => {
    const cifras: string[] = [];
    const pedidosPendientes = this.porConfirmar();
    const consultasPendientes = this.consultasSinResponder();
    const listos = this.cantidadListos();

    if (pedidosPendientes > 0) {
      cifras.push(`${pedidosPendientes} por confirmar`);
    }

    if (consultasPendientes > 0) {
      cifras.push(
        consultasPendientes === 1
          ? '1 consulta'
          : `${consultasPendientes} consultas`
      );
    }

    if (listos > 0) {
      cifras.push(
        listos === 1
          ? '1 listo para entregar'
          : `${listos} listos para entregar`
      );
    }

    const cuentas = this.cantidadCuentasPedidas();
    if (cuentas > 0) {
      cifras.push(cuentas === 1 ? '1 cuenta pedida' : `${cuentas} cuentas pedidas`);
    }

    return cifras;
  });

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();

    try {
      const [perfil] = await Promise.all([
        this.perfilActual.obtener(),
        this.resumenMozo.iniciar(),
      ]);

      this.perfil.set(perfil);
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  abrirConsulta(conversacion: ConversacionActiva): void {
    this.router.navigate(['/consultas', conversacion.solicitud_id]);
  }

  /**
   * Punto 21: el mozo rechaza el medio de pago elegido por la mesa. El
   * cliente vuelve a poder elegir y recibe una push.
   */
  async rechazarMedioPago(pedido: Pedido): Promise<void> {
    if (this.procesandoCuentaId() !== null) return;

    const alerta = await this.alertController.create({
      header: '¿Rechazar el medio de pago?',
      message: `La mesa ${pedido.numeroMesa} va a poder elegir otro medio de pago.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Rechazar', role: 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;

    this.procesandoCuentaId.set(pedido.id);
    try {
      await this.resumenMozo.rechazarMedioPago(pedido.id);
    } catch (error: unknown) {
      console.error('Error al rechazar el medio de pago:', error);
    } finally {
      this.procesandoCuentaId.set(null);
    }
  }

  /** Punto 22: el mozo confirma el pago de la mesa. */
  async confirmarPago(pedido: Pedido): Promise<void> {
    if (this.procesandoCuentaId() !== null) return;

    const alerta = await this.alertController.create({
      header: '¿Confirmar el pago?',
      message: `Mesa ${pedido.numeroMesa}: $ ${pedido.totalAPagar.toLocaleString('es-AR')} con ${nombreMedioPago(pedido.medioPago)}.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Confirmar pago', role: 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    if (role !== 'confirm') return;

    this.procesandoCuentaId.set(pedido.id);
    try {
      await this.resumenMozo.confirmarPago(pedido.id);
    } catch (error: unknown) {
      console.error('Error al confirmar el pago:', error);
    } finally {
      this.procesandoCuentaId.set(null);
    }
  }

  /**
   * Registra la entrega del pedido mediante ResumenMozoService.
   * El servicio quita el pedido de la lista solo si Supabase confirma
   * que la operación fue exitosa.
   */
  async entregarPedido(pedidoId: string): Promise<void> {
    if (this.entregandoPedidoId() !== null) {
      return;
    }

    this.entregandoPedidoId.set(pedidoId);

    try {
      await this.resumenMozo.entregarPedido(pedidoId);
    } catch (error: unknown) {
      console.error('Error al entregar el pedido:', error);
    } finally {
      this.entregandoPedidoId.set(null);
    }
  }
}
