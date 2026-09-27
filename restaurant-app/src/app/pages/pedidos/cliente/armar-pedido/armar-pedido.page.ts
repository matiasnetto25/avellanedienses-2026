import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { restaurantOutline, wineOutline, iceCreamOutline } from 'ionicons/icons';
import { ProductoCardComponent } from '../../../components/producto-card/producto-card.component';
import { AlturaDisponibleDirective } from '../../../../shared/directives/altura-disponible.directive';
import { Producto, CategoriaProducto } from '../../../../core/models/producto.model';
import { MenuItemsService } from '../../../../core/services/menu-items.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { ClienteActualService } from '../../../../core/services/cliente-actual.service';
import { SolicitudesMesaService } from '../../../../core/services/solicitudes-mesa.service';
import { CarritoService } from '../../../../core/services/carrito.service';

/**
 * Qué se muestra:
 *  - carta:      el cliente está vinculado a esta mesa y puede pedir.
 *  - sinAcceso:  no hay cliente, no está vinculado o es otra mesa.
 *  - error:      no se pudo cargar la carta.
 */
type VistaPedido = 'carta' | 'sinAcceso' | 'error';

/**
 * Carta en modo pedido (punto 12, issue 03): la misma carta de /menu, con
 * controles − y + en cada producto. Las cantidades viven en
 * CarritoService, así que se conservan al cambiar de categoría y al ir y
 * volver del resumen.
 */
@Component({
  selector: 'app-armar-pedido',
  standalone: true,
  imports: [
    AlturaDisponibleDirective,
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    ProductoCardComponent,
  ],
  templateUrl: './armar-pedido.page.html',
  // Los estilos de la carta, para que se vea igual que /menu.
  styleUrls: ['../../../menu/menu.component.scss', './armar-pedido.page.scss'],
})
export class ArmarPedidoPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly menuItems = inject(MenuItemsService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  protected readonly carrito = inject(CarritoService);

  readonly idMesa = this.route.snapshot.paramMap.get('idMesa') ?? '';
  readonly rutaMesa = `/mesa/${this.idMesa}`;

  readonly cargando = signal(true);
  readonly vista = signal<VistaPedido | null>(null);
  readonly numeroMesa = signal<number | null>(null);
  readonly productos = signal<Producto[]>([]);
  readonly categoria = signal<CategoriaProducto>('comida');

  readonly productosFiltrados = computed(() =>
    this.productos().filter((producto) => producto.categoria === this.categoria())
  );

  constructor() {
    addIcons({ restaurantOutline, wineOutline, iceCreamOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      if (!(await this.verificarMesa())) {
        this.vista.set('sinAcceso');
        return;
      }

      const productos = await this.menuItems.listarActivos();
      if (!productos) {
        this.vista.set('error');
        await this.avisos.error('No se pudo cargar la carta. Probá de nuevo.');
        return;
      }

      this.productos.set(productos);
      this.vista.set('carta');
    } catch (error) {
      console.error('Error preparando el pedido:', error);
      this.vista.set('error');
      await this.avisos.error('No se pudo cargar la carta. Probá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  /** Solo pide el cliente vinculado a ESTA mesa. */
  private async verificarMesa(): Promise<boolean> {
    const clienteId = await this.clienteActual.obtenerClienteIdActual();
    const solicitud = clienteId ? await this.solicitudesMesa.obtenerMiSolicitud(clienteId) : null;

    if (solicitud?.estado !== 'vinculado' || solicitud.mesa_id !== this.idMesa) {
      return false;
    }
    this.numeroMesa.set(solicitud.numero_mesa);
    return true;
  }

  onCambioCategoria(event: CustomEvent): void {
    this.categoria.set(event.detail.value as CategoriaProducto);
  }

  cambiarCantidad(producto: Producto, cantidad: number): void {
    this.carrito.cambiarCantidad(producto.id, cantidad);
  }

  reintentar(): void {
    this.vista.set(null);
    this.cargando.set(true);
    void this.ngOnInit();
  }

  volverALaMesa(): void {
    this.router.navigate([this.rutaMesa], { replaceUrl: true });
  }
}
