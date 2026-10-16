import { Component, OnInit, effect, inject, output, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  AlertController,
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonText,
} from '@ionic/angular/standalone';
import { Auth } from '../../../../core/services/auth';
import { AvisosService } from '../../../../core/services/avisos.service';
import { CamaraService } from '../../../../core/services/camara.service';
import { EmpleadosService } from '../../../../core/services/empleados.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import {
  ETIQUETA_PUESTO,
  EmpleadoRow,
  Puesto,
  puestosGestionablesPor,
} from '../../../../core/models/empleado.model';
import { nombreCompleto } from '../../../../core/utils/nombre-completo';
import { MENSAJES_ERROR } from '../../../../validators/empleado.mensajes';
import { validadorTextoValido } from '../../../../validators/empleado.validators';

type CampoEdicion = 'nombre' | 'apellido' | 'puesto';

/**
 * Lista de empleados para Personal → Empleados: una tarjeta por «página»,
 * a todo el alto de la pantalla (mismo patrón que gestión de mesas).
 * Va dentro de un <ion-content appAlturaDisponible> que define
 * --altura-disponible y el scroll-snap (ver personal-admin.page.scss).
 *
 * Modificar y eliminar solo se ofrecen sobre los puestos que corresponden
 * al usuario (el dueño a todos, el supervisor a los 4 operativos). Es solo
 * una ayuda visual: la Edge Function «gestionar-empleado» lo valida de nuevo.
 */
@Component({
  selector: 'app-lista-empleados',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonInput,
    IonItem,
    IonLabel,
    IonSelect,
    IonSelectOption,
    IonText,
  ],
  templateUrl: './lista-empleados.component.html',
  styleUrls: ['./lista-empleados.component.scss'],
})
export class ListaEmpleadosComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly avisos = inject(AvisosService);
  protected readonly camara = inject(CamaraService);
  private readonly empleadosService = inject(EmpleadosService);
  private readonly loading = inject(LoadingService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly alertController = inject(AlertController);

  readonly empleados = signal<EmpleadoRow[]>([]);
  readonly cargada = signal(false);
  readonly enEdicion = signal<number | null>(null);
  /** Avisa a la pantalla si hay una tarjeta en edición, para ocultar el botón de alta. */
  readonly editando = output<boolean>();
  readonly fotoNuevaDataUrl = signal<string | null>(null);
  readonly guardando = signal(false);

  readonly etiquetaPuesto = ETIQUETA_PUESTO;
  readonly nombreCompleto = nombreCompleto;

  readonly formEdicion: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, validadorTextoValido(4)]],
    apellido: ['', [Validators.required, validadorTextoValido(4)]],
    puesto: [null, Validators.required],
  });

  constructor() {
    effect(() => this.editando.emit(this.enEdicion() !== null));
    // Un alta nueva (otra pantalla) aparece en la lista sin tocar nada.
    let primera = true;
    effect(() => {
      this.empleadosService.version();
      if (primera) {
        primera = false;
        return;
      }
      void this.refrescar();
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      this.empleados.set(await this.empleadosService.listar());
    } finally {
      this.cargada.set(true);
      this.loading.ocultar();
    }
  }

  /** Vuelve a leer la lista sin spinner. */
  private async refrescar(): Promise<void> {
    if (!this.cargada()) return;
    this.empleados.set(await this.empleadosService.listar());
  }

  urlFoto(empleado: EmpleadoRow): string | null {
    return this.empleadosService.obtenerUrlFoto(empleado.foto);
  }

  esUnoMismo(empleado: EmpleadoRow): boolean {
    return empleado.id === this.auth.sesion()?.id;
  }

  puedeGestionar(empleado: EmpleadoRow): boolean {
    return puestosGestionablesPor(this.auth.sesion()?.puesto).includes(empleado.puesto);
  }

  /** Puestos que se pueden elegir al editar: uno mismo no se cambia el puesto. */
  puestosAsignables(empleado: EmpleadoRow): readonly Puesto[] {
    return this.esUnoMismo(empleado) ? [empleado.puesto] : puestosGestionablesPor(this.auth.sesion()?.puesto);
  }

  iniciarEdicion(empleado: EmpleadoRow): void {
    this.enEdicion.set(empleado.id);
    this.fotoNuevaDataUrl.set(null);
    this.formEdicion.reset({
      nombre: empleado.nombre,
      apellido: empleado.apellido,
      puesto: empleado.puesto,
    });
  }

  cancelarEdicion(): void {
    this.enEdicion.set(null);
    this.fotoNuevaDataUrl.set(null);
    this.formEdicion.reset();
  }

  mensajeError(campo: CampoEdicion): string | null {
    const control = this.formEdicion.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    const tipoError = Object.keys(control.errors)[0];
    return MENSAJES_ERROR[campo]?.[tipoError] ?? null;
  }

  async tomarNuevaFoto(): Promise<void> {
    const foto = await this.camara.tomarFotoConAviso();
    if (foto) this.fotoNuevaDataUrl.set(foto);
  }

  async guardarEdicion(empleado: EmpleadoRow): Promise<void> {
    this.formEdicion.markAllAsTouched();
    if (this.formEdicion.invalid) {
      await this.avisos.error('Revisá los campos marcados antes de guardar.');
      return;
    }
    if (!this.puedeGestionar(empleado)) {
      await this.avisos.error('No tenés permisos para modificar a este empleado.');
      return;
    }

    const { nombre, apellido, puesto } = this.formEdicion.getRawValue();
    if (!this.puestosAsignables(empleado).includes(puesto)) {
      await this.avisos.error('No tenés permisos para asignar ese puesto.');
      return;
    }

    if (this.guardando()) return;
    this.guardando.set(true);
    this.loading.mostrar();

    try {
      const resultado = await this.empleadosService.actualizarEmpleado(
        empleado,
        { nombre: nombre.trim(), apellido: apellido.trim(), puesto },
        this.fotoNuevaDataUrl() ?? undefined
      );

      if (!resultado.ok || !resultado.empleado) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo guardar al empleado.');
        return;
      }

      // La Edge Function devuelve solo algunas columnas: se mezclan con la fila que ya teníamos.
      const nuevo = resultado.empleado;
      this.empleados.update((lista) => lista.map((e) => (e.id === empleado.id ? { ...e, ...nuevo } : e)));

      // Sin toast verde: confirma la notificación push.
      this.notificaciones.avisarEmpleadoActualizado(nuevo.nombre, nuevo.apellido);
      this.cancelarEdicion();
    } finally {
      this.guardando.set(false);
      this.loading.ocultar();
    }
  }

  async confirmarEliminar(empleado: EmpleadoRow): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Eliminar empleado',
      message:
        `¿Estás seguro de que querés eliminar a ${nombreCompleto(empleado)}? ` +
        'Se borrarán también su acceso a la app y su foto. Esta acción no se puede deshacer.',
      cssClass: 'merlot-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar empleado', role: 'destructive', handler: () => this.eliminar(empleado) },
      ],
    });
    await alert.present();
  }

  private async eliminar(empleado: EmpleadoRow): Promise<void> {
    if (!this.puedeGestionar(empleado) || this.esUnoMismo(empleado)) {
      await this.avisos.error('No tenés permisos para eliminar a este empleado.');
      return;
    }

    this.loading.mostrar();
    try {
      const resultado = await this.empleadosService.eliminarEmpleado(empleado);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo eliminar al empleado.');
        return;
      }
      this.empleados.update((lista) => lista.filter((e) => e.id !== empleado.id));

      // Sin toast verde: confirma la notificación push.
      this.notificaciones.avisarEmpleadoEliminado(empleado.nombre, empleado.apellido);
    } finally {
      this.loading.ocultar();
    }
  }
}