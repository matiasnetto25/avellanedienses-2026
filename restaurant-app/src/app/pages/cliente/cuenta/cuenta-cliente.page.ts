import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, isDevMode, signal } from '@angular/core';
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
import { qrCodeOutline } from 'ionicons/icons';
import { Pedido, NIVELES_PROPINA } from '../../../core/models/pedido.model';
import { AvisosService } from '../../../core/services/avisos.service';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';
import { LoadingService } from '../../../core/services/loading.service';
import { PedidosService } from '../../../core/services/pedidos.service';
import { QrService, etiquetaPropina } from '../../../core/services/qr.service';

/**
 * La cuenta del cliente (punto 21): detalle estilo Mercado Pago y propina
 * por QR. El pedido sale de EtapaClienteService, que ya lo escucha en
 * vivo: al guardar la propina, la pantalla se actualiza sola.
 */
@Component({
  selector: 'app-cuenta-cliente',
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
  templateUrl: './cuenta-cliente.page.html',
  styleUrls: ['./cuenta-cliente.page.scss'],
})
export class CuentaClientePage {
  private readonly router = inject(Router);
  private readonly etapaCliente = inject(EtapaClienteService);
  private readonly pedidos = inject(PedidosService);
  private readonly qr = inject(QrService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  readonly rutaInicio = '/cliente/inicio';
  readonly etiquetaPropina = etiquetaPropina;
  readonly guardando = signal(false);

  /** Los botones que simulan cada QR existen solo en desarrollo: en producción se usa la cámara. */
  readonly modoPrueba = isDevMode();
  readonly nivelesPropina = NIVELES_PROPINA;

  /** El pedido en cuenta_pedida, o null cuando cambia de estado (el guard no vuelve a correr). */
  readonly pedido = computed<Pedido | null>(() => {
    const etapa = this.etapaCliente.etapa();
    return etapa?.tipo === 'estadia' && etapa.pedido?.estado === 'cuenta_pedida' ? etapa.pedido : null;
  });

  constructor() {
    addIcons({ qrCodeOutline });
  }

  async escanearPropina(pedido: Pedido): Promise<void> {
    if (this.guardando()) return;
    const lectura = await this.qr.escanearQrPropina();
    if (!lectura.ok) {
      if (!lectura.cancelado) await this.avisos.error(lectura.mensaje ?? 'No se pudo leer el QR de propina.');
      return;
    }
    await this.guardarPropina(pedido, lectura.porcentaje!);
  }

  /** Modo de prueba: hace lo mismo que el escaneo, sin cámara. */
  async simularPropina(pedido: Pedido, porcentaje: number): Promise<void> {
    if (this.guardando()) return;
    await this.guardarPropina(pedido, porcentaje);
  }

  /** Con la propina elegida, sigue la pantalla de los medios de pago. */
  irAPagar(): void {
    void this.router.navigate(['/cliente/pago']);
  }

  volverAlInicio(): void {
    void this.router.navigateByUrl(this.rutaInicio);
  }

  private async guardarPropina(pedido: Pedido, porcentaje: number): Promise<void> {
    this.guardando.set(true);
    this.loading.mostrar();
    try {
      const resultado = await this.pedidos.fijarPropina(pedido.id, porcentaje);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo guardar la propina. Probá de nuevo.');
        return;
      }
      await this.etapaCliente.refrescar();
      await this.avisos.exito(`Propina ${etiquetaPropina(porcentaje)?.toLowerCase()}: ${porcentaje} %.`);
    } finally {
      this.loading.ocultar();
      this.guardando.set(false);
    }
  }
}
