import { Component, ElementRef, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
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
import { cameraOutline } from 'ionicons/icons';
import { Auth } from '../../core/services/auth';
import { AvisosService } from '../../core/services/avisos.service';
import { CamaraService } from '../../core/services/camara.service';
import { MenuItemsService } from '../../core/services/menu-items.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { LoadingService } from '../../core/services/loading.service';
import { TIPOS_COCINERO, TipoMenuItem } from '../../core/models/menu-item.model';
import {
  validadorEnteroPositivo,
  validadorTextoNoVacio,
} from '../../validators/menu-item.validators';
import { precio, validarFormulario } from '../../core/utils/formularios';
import { AlturaDisponibleDirective } from '../../shared/directives/altura-disponible.directive';
import { AvisoCampoComponent } from '../../shared/components/aviso-campo/aviso-campo.component';
import { BarraAccionesComponent } from '../../shared/components/barra-acciones/barra-acciones.component';

type CampoFoto = 'principal' | 'cerca' | 'contexto';
const MENSAJES_ERROR: Record<string, string> = {
  required: 'Completá este campo.',
  soloEspacios: 'No puede estar vacío.',
  noEsEntero: 'Tiene que ser un número entero, sin decimales.',
  noEsPositivo: 'Tiene que ser mayor a 0.',
  precio: 'Escribí un precio mayor a 0, con hasta 2 decimales.',
  duplicado: 'Ya existe un elemento con ese nombre en la carta.',
};

@Component({
  selector: 'app-agregar-menu-item',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
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
    AlturaDisponibleDirective,
    AvisoCampoComponent,
    BarraAccionesComponent,
  ],
  templateUrl: './agregar-menu-item.page.html',
  styleUrls: ['./agregar-menu-item.page.scss'],
})
export class AgregarMenuItemPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly avisos = inject(AvisosService);
  protected readonly camara = inject(CamaraService);
  private readonly menuItemsService = inject(MenuItemsService);
  private readonly loading = inject(LoadingService);
  private readonly nav = inject(NavController);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Mensajes de error por clave, para app-aviso-campo. */
  readonly mensajes = MENSAJES_ERROR;

  readonly tiposCocinero = TIPOS_COCINERO;

  readonly camposFoto: readonly { campo: CampoFoto; etiqueta: string }[] = [
    { campo: 'principal', etiqueta: 'Principal' },
    { campo: 'cerca', etiqueta: 'De cerca' },
    { campo: 'contexto', etiqueta: 'En contexto' },
  ];

  cargando = false;
  /** Cuál de las 3 fotos se está eligiendo (para el «Abriendo…» de ese recuadro). */
  campoEligiendo: CampoFoto | null = null;

  readonly fotos = signal<Record<CampoFoto, string | null>>({
    principal: null,
    cerca: null,
    contexto: null,
  });

  /** El puesto del usuario logueado decide el modo del form — no hace falta pasar nada por ruta. */
  get esCantinero(): boolean {
    return this.auth.sesion()?.puesto === 'cantinero';
  }

  get titulo(): string {
    return this.esCantinero ? 'Agregar bebida' : 'Agregar plato';
  }

  get rutaVolver(): string {
    return this.esCantinero ? '/cantina/bebidas' : '/cocina/platos';
  }

  readonly form: FormGroup = this.fb.group({
    tipo: [null, Validators.required],
    nombre: ['', [Validators.required, validadorTextoNoVacio(2, 80)]],
    descripcion: ['', [Validators.required, validadorTextoNoVacio(5, 300)]],
    demora: ['', [Validators.required, validadorEnteroPositivo()]],
    precio: ['', [Validators.required, precio()]],
  });

  constructor() {
    addIcons({ cameraOutline });

    if (this.esCantinero) {
      // Para cantinero el tipo queda fijo en "bebida" y no seleccionable.
      this.form.get('tipo')?.setValue('bebida');
      this.form.get('tipo')?.disable();
    }
  }

  async elegirFoto(campo: CampoFoto): Promise<void> {
    if (this.camara.abriendo()) return;
    this.campoEligiendo = campo;
    const foto = await this.camara.seleccionarFotoConAviso();
    if (foto) this.fotos.update((f) => ({ ...f, [campo]: foto }));
  }

  async onSubmit(): Promise<void> {
    if (this.cargando) return;

    if (!(await validarFormulario(this.form, this.avisos, this.el.nativeElement))) return;

    const f = this.fotos();
    if (!f.principal || !f.cerca || !f.contexto) {
      await this.avisos.error('Tomá o seleccioná las 3 fotos antes de guardar.');
      return;
    }

    this.cargando = true;
    this.loading.mostrar();

    try {
      const { nombre, descripcion, demora, precio } = this.form.getRawValue();
      const tipo: TipoMenuItem = this.esCantinero ? 'bebida' : this.form.getRawValue().tipo;
      const nombreTrim = (nombre as string).trim();

      // Verificación de duplicados contra Supabase (no solo frontend).
      const existe = await this.menuItemsService.existeNombreTipo(nombreTrim, tipo);
      if (existe) {
        this.form.get('nombre')?.setErrors({ duplicado: true });
        await this.avisos.error('Revisá los campos marcados.');
        return;
      }

      const resultado = await this.menuItemsService.crearItem(
        {
          tipo,
          nombre: nombreTrim,
          descripcion: (descripcion as string).trim(),
          demora: Number(demora),
          precio: Number(precio),
        },
        { principal: f.principal, cerca: f.cerca, contexto: f.contexto }
      );

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo crear el producto.');
        return;
      }

      this.notificaciones.avisarProductoCreado(nombreTrim, tipo === 'bebida');
      await this.nav.navigateBack(this.rutaVolver);
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }
}