import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cardOutline, cashOutline, checkmarkCircle, qrCodeOutline } from 'ionicons/icons';
import { MEDIOS_PAGO, MedioPago, Pedido, nombreMedioPago } from '../../../core/models/pedido.model';
import { AvisosService } from '../../../core/services/avisos.service';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';
import { LoadingService } from '../../../core/services/loading.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { PedidosService } from '../../../core/services/pedidos.service';

/**
 * Medios de pago (punto 21): el cliente ve lo que paga y elige cómo. El
 * pago lo registra el mozo (punto 22); acá solo se le avisa el medio.
 */
@Component({
  selector: 'app-pago-cliente',
  standalone: true,
  imports: [
    DecimalPipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './pago-cliente.page.html',
  styleUrls: ['./pago-cliente.page.scss'],
})
export class PagoClientePage {
  private readonly router = inject(Router);
  private readonly etapaCliente = inject(EtapaClienteService);
  private readonly pedidos = inject(PedidosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  readonly rutaCuenta = '/cliente/cuenta';
  readonly medios = MEDIOS_PAGO;
  readonly nombreMedioPago = nombreMedioPago;
  readonly guardando = signal(false);
  /** Lo que tocó el cliente. Si todavía no tocó nada, el medio ya guardado. */
  private readonly eleccion = signal<MedioPago | null>(null);

  readonly pedido = computed<Pedido | null>(() => {
    const etapa = this.etapaCliente.etapa();
    return etapa?.tipo === 'estadia' && etapa.pedido?.estado === 'cuenta_pedida' ? etapa.pedido : null;
  });

  /** Con un medio ya guardado la pantalla queda congelada; solo el rechazo del mozo lo vuelve a null. */
  readonly congelado = computed(() => this.pedido()?.medioPago != null);

  readonly seleccionado = computed<MedioPago | null>(() => this.pedido()?.medioPago ?? this.eleccion());

  constructor() {
    // Cuando el mozo confirma el pago, el cliente vuelve a «Mi mesa» a terminar la visita.
    effect(() => {
      const etapa = this.etapaCliente.etapa();
      if (etapa?.tipo === 'estadia' && etapa.pedido?.estado === 'pagado') this.volverAlInicio();
    });

    addIcons({ cardOutline, cashOutline, checkmarkCircle, qrCodeOutline });
  }

  elegir(medio: MedioPago): void {
    if (!this.guardando() && !this.congelado()) this.eleccion.set(medio);
  }

  async confirmar(pedido: Pedido): Promise<void> {
    const medio = this.seleccionado();
    if (!medio || this.congelado() || this.guardando()) return;
    this.guardando.set(true);
    this.loading.mostrar();
    try {
      const resultado = await this.pedidos.fijarMedioPago(pedido.id, medio);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo guardar el medio de pago. Probá de nuevo.');
        return;
      }
      if (resultado.numeroMesa !== undefined) {
        this.notificaciones.avisarMedioPago(resultado.numeroMesa, nombreMedioPago(medio) ?? medio);
      }
      this.eleccion.set(null);
      await this.etapaCliente.refrescar();
      await this.avisos.exito(`Pagás con ${nombreMedioPago(medio)}. El mozo ya fue avisado.`);
    } finally {
      this.loading.ocultar();
      this.guardando.set(false);
    }
  }

  volverAlInicio(): void {
    void this.router.navigateByUrl('/cliente/inicio');
  }
}
