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
import { Pedido } from '../../../../core/models/pedido.model';
import { estadoPedido } from '../../../../core/utils/estado-visual';
import { PedidosService } from '../../../../core/services/pedidos.service';
import { ClienteActualService } from '../../../../core/services/cliente-actual.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { AvisoRechazoService } from '../components/aviso-rechazo/aviso-rechazo.service';

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
  private readonly avisoRechazo = inject(AvisoRechazoService);

  readonly estadoPedido = estadoPedido;

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

  /**
   * Cada vez que el cliente vuelve a esta pantalla (Ionic la deja en la
   * pila) y el pedido sigue rechazado, se muestra el aviso. La primera vez
   * lo muestra cargar().
   */
  ionViewDidEnter(): void {
    if (this.cargando()) return;
    const pedido = this.pedido();
    if (pedido) void this.avisoRechazo.mostrar(pedido);
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
      if (resultado.dato) {
        this.escuchar(resultado.dato.id);
        // mostrar() no hace nada si el pedido no está rechazado.
        void this.avisoRechazo.mostrar(resultado.dato);
      }
    } catch (error) {
      console.error('Error cargando el estado del pedido:', error);
      this.errorCarga.set(true);
      await this.avisos.error('No se pudo cargar tu pedido. Probá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  /**
   * Cada cambio del pedido (estado o ítems) llega por Realtime y reemplaza
   * el que se ve. Si el mozo lo acaba de rechazar, aparece el aviso (si el
   * vigilante global ya lo abrió, mostrar() no abre otro).
   *
   * Solo cuando PASA a rechazado: mientras el cliente reenvía, esta
   * pantalla sigue viva en la pila y recibe los cambios de ítems con el
   * pedido todavía rechazado; sin esta condición, el aviso aparecería
   * encima del armado.
   */
  private escuchar(pedidoId: string): void {
    this.dejarDeEscuchar?.();
    this.dejarDeEscuchar = this.pedidos.suscribirseAMiPedido(pedidoId, (pedido) => {
      const estadoAnterior = this.pedido()?.estado;
      this.pedido.set(pedido);
      if (pedido?.estado === 'rechazado' && estadoAnterior !== 'rechazado') {
        void this.avisoRechazo.mostrar(pedido);
      }
    });
  }

  reintentar(): void {
    this.errorCarga.set(false);
    this.cargando.set(true);
    void this.cargar();
  }
}
