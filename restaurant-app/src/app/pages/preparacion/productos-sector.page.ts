import { DecimalPipe } from '@angular/common';
import { Component, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cameraOutline, restaurantOutline, timeOutline, wineOutline } from 'ionicons/icons';
import { TIPOS_COCINERO, TipoMenuItem } from '../../core/models/menu-item.model';
import { SectorItem } from '../../core/models/pedido.model';
import { CategoriaProducto, Producto } from '../../core/models/producto.model';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { AvisosService } from '../../core/services/avisos.service';
import { CamaraService } from '../../core/services/camara.service';
import { LoadingService } from '../../core/services/loading.service';
import { CampoFotoMenu, MenuItemsService } from '../../core/services/menu-items.service';
import { PerfilActual, PerfilActualService } from '../../core/services/perfil-actual.service';
import { precio } from '../../core/utils/formularios';
import { AvatarPerfilComponent } from '../../shared/components/avatar-perfil/avatar-perfil.component';
import { AvisoCampoComponent } from '../../shared/components/aviso-campo/aviso-campo.component';
import { BarraAccionesComponent } from '../../shared/components/barra-acciones/barra-acciones.component';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../shared/directives/altura-disponible.directive';
import { validadorEnteroPositivo, validadorTextoNoVacio } from '../../validators/menu-item.validators';

const TEXTOS_POR_SECTOR: Record<SectorItem, {
  titulo: string;
  tipos: CategoriaProducto[];
  rutaAlta: string;
  accion: string;
  vacio: string;
  icono: string;
  singular: string;
}> = {
  cocina: {
    titulo: 'Platos',
    tipos: ['comida', 'postre'],
    rutaAlta: '/cocina/agregar-plato',
    accion: 'Agregar plato',
    vacio: 'Todavía no cargaste platos',
    icono: 'restaurant-outline',
    singular: 'plato',
  },
  bar: {
    titulo: 'Bebidas',
    tipos: ['bebida'],
    rutaAlta: '/cantina/agregar-bebida',
    accion: 'Agregar bebida',
    vacio: 'Todavía no cargaste bebidas',
    icono: 'wine-outline',
    singular: 'bebida',
  },
};

const FOTOS: readonly { campo: CampoFotoMenu; etiqueta: string }[] = [
  { campo: 'principal', etiqueta: 'Principal' },
  { campo: 'cerca', etiqueta: 'De cerca' },
  { campo: 'contexto', etiqueta: 'En contexto' },
];

const MENSAJES_ERROR: Record<string, string> = {
  required: 'Completá este campo.',
  soloEspacios: 'No puede estar vacío.',
  noEsEntero: 'Tiene que ser un número entero, sin decimales.',
  noEsPositivo: 'Tiene que ser mayor a 0.',
  precio: 'Escribí un precio mayor a 0, con hasta 2 decimales.',
  duplicado: 'Ya existe un producto con ese nombre en la carta.',
};

/**
 * Lista de platos (cocinero) o bebidas (cantinero): una tarjeta por
 * pantalla, el scroll «encaja» en cada una (mismo patrón que Salón y
 * Personal). Cada tarjeta se puede modificar o eliminar.
 */
@Component({
  selector: 'app-productos-sector',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    AlturaDisponibleDirective,
    AvatarPerfilComponent,
    AvisoCampoComponent,
    BarraAccionesComponent,
    DecimalPipe,
    EstadoVacioComponent,
    IonButton,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './productos-sector.page.html',
  styleUrls: ['./productos-sector.page.scss'],
})
export class ProductosSectorPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly menuItems = inject(MenuItemsService);
  private readonly avisos = inject(AvisosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  protected readonly camara = inject(CamaraService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly nav = inject(NavController);
  private readonly alertController = inject(AlertController);

  readonly textos = TEXTOS_POR_SECTOR[inject(ActivatedRoute).snapshot.data['sector'] as SectorItem];
  readonly esCocina = this.textos.tipos.length > 1;
  readonly tiposPlato = TIPOS_COCINERO;
  readonly fotos = FOTOS;
  readonly mensajes = MENSAJES_ERROR;

  readonly perfil = signal<PerfilActual | null>(null);
  readonly cargando = signal(true);
  readonly productos = signal<Producto[]>([]);

  /** Producto que se está editando (id) y las fotos nuevas elegidas para él. */
  readonly enEdicion = signal<string | null>(null);
  readonly fotosNuevas = signal<Partial<Record<CampoFotoMenu, string>>>({});
  readonly campoEligiendo = signal<CampoFotoMenu | null>(null);
  readonly guardando = signal(false);

  /** Foto visible (índice) de cada carrusel, por producto: para el contador «1/3». */
  readonly fotoActiva = signal<Record<string, number | undefined>>({});

  readonly form: FormGroup = this.fb.group({
    tipo: [null],
    nombre: ['', [Validators.required, validadorTextoNoVacio(2, 80)]],
    descripcion: ['', [Validators.required, validadorTextoNoVacio(5, 300)]],
    demora: ['', [Validators.required, validadorEnteroPositivo()]],
    precio: ['', [Validators.required, precio()]],
  });

  constructor() {
    addIcons({ cameraOutline, restaurantOutline, timeOutline, wineOutline });
    // Se relee al entrar y después de cada alta, edición o baja.
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

  /** Fotos del producto que sí tienen imagen cargada. */
  fotosDe(p: Producto): { url: string; etiqueta: string }[] {
    return FOTOS.map((f, i) => ({ url: p.imagenes[i], etiqueta: f.etiqueta })).filter((f) => !!f.url);
  }

  alScrollearFotos(p: Producto, evento: Event): void {
    const el = evento.target as HTMLElement;
    const indice = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
    this.fotoActiva.update((m) => (m[p.id] === indice ? m : { ...m, [p.id]: indice }));
  }

  etiquetaCategoria(p: Producto): string {
    return p.categoria === 'postre' ? 'Postre' : p.categoria === 'comida' ? 'Comida' : 'Bebida';
  }

  // ------------------------------------------------------------- edición

  iniciarEdicion(p: Producto): void {
    this.enEdicion.set(p.id);
    this.fotosNuevas.set({});
    this.form.reset({
      tipo: p.categoria,
      nombre: p.nombre,
      descripcion: p.descripcion,
      demora: p.demoraMin || '',
      precio: p.precio,
    });
  }

  cancelarEdicion(): void {
    this.enEdicion.set(null);
    this.fotosNuevas.set({});
    this.form.reset();
  }

  /** Foto a mostrar en el editor: la nueva si se eligió una, si no la actual. */
  fotoEdicion(p: Producto, campo: CampoFotoMenu, indice: number): string {
    return this.fotosNuevas()[campo] ?? p.imagenes[indice];
  }

  async cambiarFoto(campo: CampoFotoMenu): Promise<void> {
    if (this.camara.abriendo()) return;
    this.campoEligiendo.set(campo);
    const foto = await this.camara.seleccionarFotoConAviso();
    if (foto) this.fotosNuevas.update((f) => ({ ...f, [campo]: foto }));
  }

  async guardarEdicion(p: Producto): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      await this.avisos.error('Revisá los campos marcados antes de guardar.');
      return;
    }
    if (this.guardando()) return;

    const { tipo, nombre, descripcion, demora, precio: precioIngresado } = this.form.getRawValue();
    const categoria: TipoMenuItem = this.esCocina ? (tipo ?? p.categoria) : 'bebida';

    this.guardando.set(true);
    this.loading.mostrar();
    try {
      if (await this.menuItems.existeNombreTipo(nombre, categoria, p.id)) {
        this.form.get('nombre')?.setErrors({ duplicado: true });
        await this.avisos.error(MENSAJES_ERROR['duplicado']);
        return;
      }

      const resultado = await this.menuItems.actualizarItem(
        p.id,
        {
          ...(this.esCocina ? { tipo: categoria } : {}),
          nombre,
          descripcion,
          demora: Number(demora),
          precio: Number(precioIngresado),
        },
        this.fotosNuevas()
      );

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo guardar el producto.');
        return;
      }

      this.cancelarEdicion();
      this.notificaciones.avisarProductoActualizado(nombre.trim(), categoria === 'bebida');
    } finally {
      this.guardando.set(false);
      this.loading.ocultar();
    }
  }

  // ------------------------------------------------------------ eliminar

  async confirmarEliminar(p: Producto): Promise<void> {
    const alert = await this.alertController.create({
      header: `Eliminar ${this.textos.singular}`,
      message: `¿Querés eliminar "${p.nombre}" de la carta? Los clientes dejarán de verlo y de poder pedirlo.`,
      cssClass: 'merlot-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: `Eliminar ${this.textos.singular}`, role: 'destructive', handler: () => this.eliminar(p) },
      ],
    });
    await alert.present();
  }

  private async eliminar(p: Producto): Promise<void> {
    this.loading.mostrar();
    try {
      const resultado = await this.menuItems.darDeBaja(p.id);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo eliminar el producto.');
        return;
      }
      this.productos.update((lista) => lista.filter((x) => x.id !== p.id));
      this.notificaciones.avisarProductoEliminado(p.nombre, p.categoria === 'bebida');
    } finally {
      this.loading.ocultar();
    }
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