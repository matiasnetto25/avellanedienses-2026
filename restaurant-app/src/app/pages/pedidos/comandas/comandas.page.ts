import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { ItemComanda, SectorItem } from '../../../core/models/pedido.model';
import { PedidosService } from '../../../core/services/pedidos.service';
import { AvisosService } from '../../../core/services/avisos.service';
import { LoadingService } from '../../../core/services/loading.service';

/** Lo que cambia entre la pantalla de cocina y la de bar. */
const TEXTOS_POR_SECTOR: Record<SectorItem, { titulo: string; volver: string }> = {
  cocina: { titulo: 'Comandas de cocina', volver: '/cocina' },
  bar: { titulo: 'Comandas de bar', volver: '/cantina' },
};

/**
 * Comandas de un sector (punto 14): los ítems de los pedidos confirmados
 * que le tocan preparar. La misma pantalla sirve para cocina y bar: el
 * sector llega en el data de la ruta.
 *
 * Mínima a propósito: los puntos 16 y 17 agrupan por mesa y agregan los
 * cambios de estado de cada ítem.
 */
@Component({
  selector: 'app-comandas',
  standalone: true,
  imports: [
    DatePipe,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCard,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './comandas.page.html',
  styleUrls: ['./comandas.page.scss'],
})
export class ComandasPage implements OnInit, OnDestroy {
  private readonly pedidosService = inject(PedidosService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  readonly sector: SectorItem = inject(ActivatedRoute).snapshot.data['sector'];
  readonly textos = TEXTOS_POR_SECTOR[this.sector];

  readonly cargando = signal(true);
  readonly errorCarga = signal(false);
  readonly comandas = signal<ItemComanda[]>([]);

  private dejarDeEscuchar: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      await this.cargar();
      // Un pedido confirmado o un ítem que cambia: se relee la lista entera.
      this.dejarDeEscuchar = this.pedidosService.suscribirseAComandas(this.sector, () => this.cargar());
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
    const comandas = await this.pedidosService.listarComandas(this.sector);
    if (comandas === null) {
      // Si ya había una lista, se deja la que estaba: el próximo cambio la refresca.
      if (this.comandas().length === 0) this.errorCarga.set(true);
      await this.avisos.error('No se pudieron cargar las comandas. Probá de nuevo.');
      return;
    }
    this.errorCarga.set(false);
    this.comandas.set(comandas);
  }

  async reintentar(): Promise<void> {
    await this.loading.envolver(this.cargar());
  }
}
