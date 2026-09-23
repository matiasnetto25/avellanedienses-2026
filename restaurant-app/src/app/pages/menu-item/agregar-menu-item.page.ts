import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonText,
  IonBackButton,
  IonButtons,
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
  validadorNumeroPositivo,
  validadorTextoNoVacio,
} from '../../validators/menu-item.validators';

type CampoFoto = 'principal' | 'cerca' | 'contexto';
type CampoTexto = 'tipo' | 'nombre' | 'descripcion' | 'demora' | 'precio';

const MENSAJES_ERROR: Record<string, string> = {
  required: 'Este campo es obligatorio.',
  soloEspacios: 'No puede estar vacío.',
  noEsEntero: 'Debe ser un número entero, sin decimales.',
  noEsPositivo: 'Debe ser mayor a 0.',
  noEsNumero: 'Ingresá un número válido.',
  duplicado: 'Ya existe un elemento con ese nombre en la carta.',
};

@Component({
  selector: 'app-agregar-menu-item',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonText,
    IonBackButton,
    IonButtons,
  ],
  templateUrl: './agregar-menu-item.page.html',
  styleUrls: ['./agregar-menu-item.page.scss'],
})
export class AgregarMenuItemPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly avisos = inject(AvisosService);
  private readonly camara = inject(CamaraService);
  private readonly menuItemsService = inject(MenuItemsService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  readonly tiposCocinero = TIPOS_COCINERO;

  readonly camposFoto: readonly { campo: CampoFoto; etiqueta: string }[] = [
    { campo: 'principal', etiqueta: 'Foto principal' },
    { campo: 'cerca', etiqueta: 'Foto de cerca' },
    { campo: 'contexto', etiqueta: 'Foto de contexto' },
  ];

  cargando = false;
  subiendoFoto: CampoFoto | null = null;

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
    return this.esCantinero ? '/cantina' : '/cocina';
  }

  readonly form: FormGroup = this.fb.group({
    tipo: [null, Validators.required],
    nombre: ['', [Validators.required, validadorTextoNoVacio(2, 80)]],
    descripcion: ['', [Validators.required, validadorTextoNoVacio(5, 300)]],
    demora: ['', [Validators.required, validadorEnteroPositivo()]],
    precio: ['', [Validators.required, validadorNumeroPositivo()]],
  });

  constructor() {
    addIcons({ cameraOutline });

    if (this.esCantinero) {
      // Para cantinero el tipo queda fijo en "bebida" y no seleccionable.
      this.form.get('tipo')?.setValue('bebida');
      this.form.get('tipo')?.disable();
    }
  }

  mensajeError(campo: CampoTexto): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;

    const tipoError = Object.keys(control.errors)[0];
    if (control.errors['minlength']) {
      return `Debe tener al menos ${control.errors['minlength'].requiredLength} caracteres.`;
    }
    if (control.errors['maxlength']) {
      return `No puede superar los ${control.errors['maxlength'].requiredLength} caracteres.`;
    }
    return MENSAJES_ERROR[tipoError] ?? null;
  }

  async elegirFoto(campo: CampoFoto): Promise<void> {
    if (this.subiendoFoto) return;
    this.subiendoFoto = campo;
    try {
      const resultado = await this.camara.seleccionarFoto();
      if (resultado.ok && resultado.dataUrl) {
        this.fotos.update((f) => ({ ...f, [campo]: resultado.dataUrl! }));
      } else if (!resultado.cancelado) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo obtener la imagen.');
      }
    } finally {
      this.subiendoFoto = null;
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      await this.avisos.error('Revisá los campos marcados antes de continuar.');
      return;
    }

    const f = this.fotos();
    if (!f.principal || !f.cerca || !f.contexto) {
      await this.avisos.error('Tomá o seleccioná las 3 fotos antes de guardar.');
      return;
    }

    if (this.cargando) return;
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
        await this.avisos.error(MENSAJES_ERROR['duplicado']);
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

      // Sin toast verde acá: confirma la notificación push (abajo).

      this.notificaciones.notificarCreacion(
        this.esCantinero ? 'Nueva bebida en la carta' : 'Nuevo plato en la carta',
        `Se agregó "${nombreTrim}" al menú.`,
        { ruta: '/menu' }
      );

      this.form.reset();
      if (this.esCantinero) {
        this.form.get('tipo')?.setValue('bebida');
      }
      this.fotos.set({ principal: null, cerca: null, contexto: null });
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }
}