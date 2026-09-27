import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
} from '@ionic/angular/standalone';
import { Pedido, etiquetaEstadoPedido } from '../../../../core/models/pedido.model';
import { PedidosService } from '../../../../core/services/pedidos.service';
import { ClienteActualService } from '../../../../core/services/cliente-actual.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { LoadingService } from '../../../../core/services/loading.service';

@Component({
  selector: 'app-estado-pedido',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
  ],
  templateUrl: './estado-pedido.page.html',
  styleUrls: ['./estado-pedido.page.scss'],
})
export class EstadoPedidoPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly pedidos = inject(PedidosService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  readonly etiquetaEstado = etiquetaEstadoPedido;

  readonly idMesa = this.route.snapshot.paramMap.get('idMesa') ?? '';
  readonly rutaMesa = `/mesa/${this.idMesa}`;
  /** Viene de la pantalla de la mesa (?mesa=N); se reenvía a «Hacer pedido». */
  readonly queryMesa = this.route.snapshot.queryParams;

  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  /** null: todavía no hizo un pedido en esta estadía. */
  readonly pedido = signal<Pedido | null>(null);

  private dejarDeEscuchar: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar?.();
  }

  private async cargar(): Promise<void> {
    this.loading.mostrar();
    try {
      const clienteId = await this.clienteActual.obtenerClienteIdActual();
      const resultado = clienteId ? await this.pedidos.obtenerMiPedidoActivo(clienteId) : { ok: false as const };

      if (!resultado.ok) {
        this.errorCarga.set(true);
        await this.avisos.error('No se pudo cargar tu pedido. Probá de nuevo.');
        return;
      }

      this.pedido.set(resultado.dato);
      if (resultado.dato) this.escuchar(resultado.dato.id);
    } catch (error) {
      console.error('Error cargando el estado del pedido:', error);
      this.errorCarga.set(true);
      await this.avisos.error('No se pudo cargar tu pedido. Probá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  /** Cada cambio del pedido (estado o ítems) llega por Realtime y reemplaza el que se ve. */
  private escuchar(pedidoId: string): void {
    this.dejarDeEscuchar?.();
    this.dejarDeEscuchar = this.pedidos.suscribirseAMiPedido(pedidoId, (pedido) => this.pedido.set(pedido));
  }

  reintentar(): void {
    this.errorCarga.set(false);
    this.cargando.set(true);
    void this.cargar();
  }
}
