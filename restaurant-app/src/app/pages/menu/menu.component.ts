import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
import { AlturaDisponibleDirective } from '../../shared/directives/altura-disponible.directive';
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
    AlturaDisponibleDirective,
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
  private readonly menuItemsService = inject(MenuItemsService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly location = inject(Location);
  private readonly route = inject(ActivatedRoute);

  categoriaSeleccionada: CategoriaProducto = 'comida';

  /** true mientras se traen los productos: evita mostrar "no hay productos" antes de tiempo. */
  cargando = true;

  /**
   * Número de mesa cuando la carta se abre desde la pantalla de la mesa
   * (/menu?mesa=5). Es solo informativo, para el encabezado; null si se
   * abrió desde otro lado.
   */
  readonly numeroMesa = this.leerNumeroMesa();

  readonly enPestana = !!this.route.snapshot.data['enPestana'];

  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];

  constructor() {
    addIcons({ restaurantOutline, wineOutline, iceCreamOutline, arrowBackOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const productos = await this.menuItemsService.listarActivos();
      if (!productos) {
        await this.avisos.error('No se pudo cargar el menú. Probá de nuevo.');
        return;
      }
      this.productos = productos;
      this.filtrarPorCategoria();
    } catch (error) {
      console.error('Error cargando el menú:', error);
      await this.avisos.error('No se pudo cargar el menú. Probá de nuevo.');
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }

  private leerNumeroMesa(): number | null {
    const valor = Number(this.route.snapshot.queryParamMap.get('mesa'));
    return Number.isInteger(valor) && valor > 0 ? valor : null;
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
  }
}