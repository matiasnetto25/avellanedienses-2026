import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { Pedido } from '../../../../core/models/pedido.model';
import { PedidosService } from '../../../../core/services/pedidos.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { LoadingService } from '../../../../core/services/loading.service';

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
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './pedidos-pendientes.page.html',
  styleUrls: ['./pedidos-pendientes.page.scss'],
})
export class PedidosPendientesPage implements OnInit, OnDestroy {
  private readonly pedidosService = inject(PedidosService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly pedidos = signal<Pedido[]>([]);

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
}
