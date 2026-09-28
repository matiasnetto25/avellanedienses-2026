import { DecimalPipe } from '@angular/common';
import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { restaurantOutline, timeOutline, wineOutline } from 'ionicons/icons';
import { SectorItem } from '../../core/models/pedido.model';
import { CategoriaProducto, Producto } from '../../core/models/producto.model';
import { MenuItemsService } from '../../core/services/menu-items.service';
import { AvisosService } from '../../core/services/avisos.service';
import { PerfilActual, PerfilActualService } from '../../core/services/perfil-actual.service';
import { AvatarPerfilComponent } from '../../shared/components/avatar-perfil/avatar-perfil.component';
import { BarraAccionesComponent } from '../../shared/components/barra-acciones/barra-acciones.component';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../shared/directives/altura-disponible.directive';

const TEXTOS_POR_SECTOR: Record<SectorItem, {
  titulo: string;
  tipos: CategoriaProducto[];
  rutaAlta: string;
  accion: string;
  vacio: string;
  icono: string;
}> = {
  cocina: {
    titulo: 'Platos',
    tipos: ['comida', 'postre'],
    rutaAlta: '/cocina/agregar-plato',
    accion: 'Agregar plato',
    vacio: 'Todavía no cargaste platos',
    icono: 'restaurant-outline',
  },
  bar: {
    titulo: 'Bebidas',
    tipos: ['bebida'],
    rutaAlta: '/cantina/agregar-bebida',
    accion: 'Agregar bebida',
    vacio: 'Todavía no cargaste bebidas',
    icono: 'wine-outline',
  },
};

@Component({
  selector: 'app-productos-sector',
  standalone: true,
  imports: [
    AlturaDisponibleDirective,
    AvatarPerfilComponent,
    BarraAccionesComponent,
    DecimalPipe,
    EstadoVacioComponent,
    IonButton,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './productos-sector.page.html',
  styleUrls: ['./productos-sector.page.scss'],
})
export class ProductosSectorPage implements OnInit {
  private readonly menuItems = inject(MenuItemsService);
  private readonly avisos = inject(AvisosService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly nav = inject(NavController);

  readonly textos = TEXTOS_POR_SECTOR[inject(ActivatedRoute).snapshot.data['sector'] as SectorItem];

  readonly perfil = signal<PerfilActual | null>(null);
  readonly cargando = signal(true);
  readonly productos = signal<Producto[]>([]);

  constructor() {
    addIcons({ restaurantOutline, timeOutline, wineOutline });
    // Se relee al entrar y después de cada alta (al volver del formulario).
    effect(() => {
      this.menuItems.altas();
      untracked(() => void this.cargar());
    });
  }

  async ngOnInit(): Promise<void> {
    this.perfil.set(await this.perfilActual.obtener());
  }

  agregar(): void {
    this.nav.navigateForward(this.textos.rutaAlta);
  }

  private async cargar(): Promise<void> {
    const productos = await this.menuItems.listarActivos();
    this.cargando.set(false);
    if (productos === null) {
      await this.avisos.error('No se pudieron cargar los productos. Probá de nuevo.');
      return;
    }
    this.productos.set(productos.filter((p) => this.textos.tipos.includes(p.categoria)));
  }
}
