import { CommonModule, Location } from '@angular/common';
import { Component, HostListener, OnInit, ViewChild, inject } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonLabel,
} from '@ionic/angular/standalone'
import { addIcons } from 'ionicons';
import { restaurantOutline, wineOutline, iceCreamOutline, arrowBackOutline } from 'ionicons/icons';
import { ProductoCardComponent } from '../components/producto-card/producto-card.component';
import { Producto, CategoriaProducto } from '../../core/models/producto.model';
import { MenuItemsService } from '../../core/services/menu-items.service';
import { AvisosService } from '../../core/services/avisos.service';
import { LoadingService } from '../../core/services/loading.service';

@Component({
  selector: 'app-menu',
  standalone: true,
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.scss'],
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    ProductoCardComponent,
  ],
})
export class MenuComponent implements OnInit {
  @ViewChild(IonContent) private readonly ionContent!: IonContent;
  private readonly menuItemsService = inject(MenuItemsService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly location = inject(Location);

  categoriaSeleccionada: CategoriaProducto = 'comida';

  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];

  /** Siempre 1 producto por página. */
  paginas: Producto[][] = [];

  constructor() {
    addIcons({ restaurantOutline, wineOutline, iceCreamOutline, arrowBackOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      this.productos = await this.menuItemsService.listarActivos();
      this.filtrarPorCategoria();
    } catch (error) {
      console.error('Error cargando el menú:', error);
      await this.avisos.error('No se pudo cargar el menú. Probá de nuevo.');
    } finally {
      this.loading.ocultar();
    }

    requestAnimationFrame(() => {
      this.medirAlturaDisponible();
    });
  }

  async ionViewDidEnter(): Promise<void> {
    await this.medirAlturaDisponible();
  }

  @HostListener('window:resize')
  async onResize(): Promise<void> {
    await this.medirAlturaDisponible();
  }

private async medirAlturaDisponible(): Promise<void> {
  if (!this.ionContent) return;

  const scrollEl = await this.ionContent.getScrollElement();
  const altura = scrollEl.clientHeight;

  if (!altura) return;

  scrollEl.style.setProperty(
    '--altura-disponible',
    `${altura}px`
  );
}

  volver(): void {
    this.location.back();
  }

  onCambioCategoria(event: CustomEvent): void {
    this.categoriaSeleccionada = event.detail.value as CategoriaProducto;
    this.filtrarPorCategoria();
  }

  private filtrarPorCategoria(): void {
    this.productosFiltrados = this.productos.filter(
      (p) => p.categoria === this.categoriaSeleccionada
    );
    this.paginas = this.productosFiltrados.map((p) => [p]);
  }
}