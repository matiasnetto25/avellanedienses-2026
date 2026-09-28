import { Component, OnInit, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { FilaPedidoComponent } from '../components/fila-pedido/fila-pedido.component';
import { ResumenMozoService } from '../../../../core/services/resumen-mozo.service';
import { LoadingService } from '../../../../core/services/loading.service';

@Component({
  selector: 'app-pedidos-pendientes',
  standalone: true,
  imports: [IonButton, IonContent, IonHeader, IonTitle, IonToolbar, FilaPedidoComponent],
  templateUrl: './pedidos-pendientes.page.html',
  styleUrls: ['./pedidos-pendientes.page.scss'],
})
export class PedidosPendientesPage implements OnInit {
  private readonly resumen = inject(ResumenMozoService);
  private readonly loading = inject(LoadingService);

  readonly cargando = signal(true);
  readonly errorCarga = this.resumen.errorPedidos;
  readonly pedidos = this.resumen.pedidos;

  async ngOnInit(): Promise<void> {
    try {
      await this.loading.envolver(this.resumen.iniciar());
    } finally {
      this.cargando.set(false);
    }
  }

  /** Al volver a la pantalla (Ionic la deja guardada en la pila), refresca. */
  async ionViewWillEnter(): Promise<void> {
    if (!this.cargando()) await this.resumen.recargarPedidos();
  }

  async reintentar(): Promise<void> {
    await this.loading.envolver(this.resumen.recargarPedidos());
  }
}
