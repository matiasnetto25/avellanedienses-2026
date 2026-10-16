import { Component, ElementRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cameraOutline } from 'ionicons/icons';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { AvisoCampoComponent } from '../../../shared/components/aviso-campo/aviso-campo.component';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { Auth } from '../../../core/services/auth';
import { AvisosService } from '../../../core/services/avisos.service';
import { CamaraService } from '../../../core/services/camara.service';
import { DniScannerService } from '../../../core/services/scanDNI.service';
import { EmpleadosService } from '../../../core/services/empleados.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import {
  ETIQUETA_PUESTO,
  Puesto,
  PUESTOS_CREABLES_POR_SUPERVISOR,
  PUESTOS_TODOS,
} from '../../../core/models/empleado.model';
import {
  validadorDniDelCuil,
  validadorEmailValido,
  validadorRepetirPassword,
  validadorTextoValido,
} from '../../../validators/empleado.validators';
import { cuil, dni, validarFormulario } from '../../../core/utils/formularios';
import { MENSAJES_ERROR } from '../../../validators/empleado.mensajes';

@Component({
  selector: 'app-personal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
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
    IonTitle,
    IonToolbar,
    AlturaDisponibleDirective,
    AvisoCampoComponent,
    BarraAccionesComponent,
  ],
  templateUrl: './personal.page.html',
  styleUrls: ['./personal.page.scss'],
})
export class PersonalPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly avisos = inject(AvisosService);
  protected readonly camara = inject(CamaraService);
  private readonly dniScanner = inject(DniScannerService);
  private readonly empleadosService = inject(EmpleadosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  cargando = false;
  escaneando = false;

  /** Mensajes de cada campo para app-aviso-campo (pisan a los de default). */
  readonly mensajes = MENSAJES_ERROR;
  readonly etiquetaPuesto = ETIQUETA_PUESTO;

  readonly fotoDataUrl = signal<string | null>(null);

  /** Datos del empleado recién creado: con esto se muestra la vista de éxito. */
  readonly empleadoCreado = signal<{ nombre: string; apellido: string; puesto: Puesto; foto: string } | null>(null);

  get puestosDisponibles(): readonly Puesto[] {
    return this.auth.sesion()?.puesto === 'dueño' ? PUESTOS_TODOS : PUESTOS_CREABLES_POR_SUPERVISOR;
  }

  readonly form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, validadorTextoValido(4)]],
    apellido: ['', [Validators.required, validadorTextoValido(4)]],
    dni: ['', [Validators.required, dni(), validadorDniDelCuil('cuil')]],
    cuil: ['', [Validators.required, cuil()]],
    email: ['', [Validators.required, validadorEmailValido()]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmarPassword: ['', [Validators.required, validadorRepetirPassword('password')]],
    puesto: [null, Validators.required],
  });

  constructor() {
    addIcons({ cameraOutline });

    // Estos dos campos dependen de otro: se vuelven a validar cuando el otro cambia.
    this.form.controls['password'].valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls['confirmarPassword'].updateValueAndValidity());
    this.form.controls['cuil'].valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls['dni'].updateValueAndValidity());
  }

  /** Al salir del CUIL: si ya pertenece a un empleado, el error se ve debajo del campo. */
  async onBlurCuil(): Promise<void> {
    const control = this.form.controls['cuil'];
    const valor = (control.value ?? '').trim();
    if (!valor || control.errors) return;

    if (await this.empleadosService.existeCuil(valor)) {
      control.setErrors({ cuilDuplicado: true });
    }
  }

  /** Al salir del correo: si ya pertenece a un empleado, el error se ve debajo del campo. */
  async onBlurEmail(): Promise<void> {
    const control = this.form.controls['email'];
    const valor = (control.value ?? '').trim();
    if (!valor || control.errors) return;

    if (await this.empleadosService.existeEmail(valor)) {
      control.setErrors({ emailDuplicado: true });
    }
  }

  async tomarFoto(): Promise<void> {
    const foto = await this.camara.tomarFotoConAviso();
    if (foto) this.fotoDataUrl.set(foto);
  }

  volverATomarFoto(): void {
    this.fotoDataUrl.set(null);
  }

  async escanearDni(): Promise<void> {
    if (this.escaneando) return;
    this.escaneando = true;
    try {
      const resultado = await this.dniScanner.escanear();

      if (!resultado.ok) {
        if (!resultado.cancelado) {
          await this.avisos.error(resultado.mensaje ?? 'No se pudo escanear el DNI.');
        }
        return;
      }

      const d = resultado.datos!;
      this.form.patchValue({
        nombre: d.nombre ?? this.form.value.nombre,
        apellido: d.apellido ?? this.form.value.apellido,
        dni: d.dni ?? this.form.value.dni,
        cuil: d.cuilSugerido ?? this.form.value.cuil,
      });

      await this.avisos.info('Datos completados desde el DNI. Revisalos antes de guardar.');
    } finally {
      this.escaneando = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.cargando) return;

    if (!(await validarFormulario(this.form, this.avisos, this.el.nativeElement))) return;

    if (!this.fotoDataUrl()) {
      await this.avisos.error('Tomá una foto del empleado antes de guardar.');
      return;
    }

    this.cargando = true;
    this.loading.mostrar();

    try {
      const { nombre, apellido, cuil, email, password, puesto } = this.form.getRawValue();

      if (!this.puestosDisponibles.includes(puesto)) {
        await this.avisos.error('No tenés permisos para crear un empleado con ese puesto.');
        return;
      }

      const [cuilExiste, emailExiste] = await Promise.all([
        this.empleadosService.existeCuil(cuil),
        this.empleadosService.existeEmail(email),
      ]);

      if (cuilExiste || emailExiste) {
        // El mensaje de cada campo se ve debajo de él.
        if (cuilExiste) this.form.controls['cuil'].setErrors({ cuilDuplicado: true });
        if (emailExiste) this.form.controls['email'].setErrors({ emailDuplicado: true });
        await this.avisos.error('Revisá los campos marcados.');
        return;
      }

      const resultado = await this.empleadosService.crearEmpleado(
        { nombre, apellido, cuil, email, password, puesto },
        this.fotoDataUrl()!
      );

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo crear el empleado.');
        return;
      }

      // Sin toast verde acá: la confirmación la da la notificación push.
      // Los toasts de avisos.error() siguen intactos para cuando algo falla.
      this.notificaciones.avisarNuevoEmpleado(nombre, apellido, puesto);

      // La vista de éxito muestra la foto que se acaba de subir.
      this.empleadoCreado.set({ nombre, apellido, puesto, foto: this.fotoDataUrl()! });
      this.form.reset();
      this.fotoDataUrl.set(null);
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }

  /** Vuelve al formulario vacío para cargar a otra persona. */
  darDeAltaOtro(): void {
    this.empleadoCreado.set(null);
  }
}