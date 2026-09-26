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
  IonSelect,
  IonSelectOption,
  IonButton,
  IonText,
  IonBackButton,
  IonButtons,
} from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { AvisosService } from '../../../core/services/avisos.service';
import { CamaraService } from '../../../core/services/camara.service';
import { DniScannerService } from '../../../core/services/scanDNI.service';
import { EmpleadosService } from '../../../core/services/empleados.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { Puesto, PUESTOS_CREABLES_POR_SUPERVISOR, PUESTOS_TODOS, Sexo } from '../../../core/models/empleado.model';
import {
  validadorCuil,
  validadorEmailValido,
  validadorFechaNacimiento,
  validadorPasswordsCoinciden,
  validadorTextoValido,
} from '../../../validators/empleado.validators';

type CampoTexto = 'nombre' | 'apellido' | 'cuil' | 'email' | 'password' | 'confirmarPassword';

const MENSAJES_ERROR: Record<string, Record<string, string>> = {
  nombre: {
    required: 'Ingresá el nombre.',
    soloEspacios: 'El nombre no puede estar vacío.',
    minlength: 'El nombre debe tener al menos 4 caracteres.',
    soloTexto: 'El nombre solo puede contener letras.',
  },
  apellido: {
    required: 'Ingresá el apellido.',
    soloEspacios: 'El apellido no puede estar vacío.',
    minlength: 'El apellido debe tener al menos 4 caracteres.',
    soloTexto: 'El apellido solo puede contener letras.',
  },
  cuil: {
    required: 'Ingresá el CUIL.',
    formatoCuil: 'El CUIL debe tener el formato XX-XXXXXXXX-X.',
    cuilDuplicado: 'El CUIL ingresado ya pertenece a un empleado.',
  },
  email: {
    required: 'Ingresá el email.',
    email: 'El email ingresado no es válido.',
    emailDuplicado: 'El email ingresado ya pertenece a un empleado.',
  },
  password: {
    required: 'Ingresá una contraseña.',
    minlength: 'La contraseña debe tener al menos 6 caracteres.',
  },
  confirmarPassword: {
    required: 'Repetí la contraseña.',
  },
  sexo: { required: 'Seleccioná el sexo.' },
  fecha_nacimiento: {
    required: 'Ingresá la fecha de nacimiento.',
    fechaInvalida: 'La fecha ingresada no es válida.',
    fechaFutura: 'La fecha de nacimiento no puede ser futura.',
    edadFueraDeRango: 'La edad calculada no es razonable, revisá la fecha.',
  },
  puesto: { required: 'Seleccioná el puesto.' },
};

@Component({
  selector: 'app-personal',
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
    IonSelect,
    IonSelectOption,
    IonButton,
    IonText,
    IonBackButton,
    IonButtons,
  ],
  templateUrl: './personal.page.html',
  styleUrls: ['./personal.page.scss'],
})
export class PersonalPage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly avisos = inject(AvisosService);
  private readonly camara = inject(CamaraService);
  private readonly dniScanner = inject(DniScannerService);
  private readonly empleadosService = inject(EmpleadosService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  cargando = false;
  escaneando = false;
  tomandoFoto = false;

  readonly fotoDataUrl = signal<string | null>(null);

  readonly opcionesSexo: readonly { valor: Sexo; etiqueta: string }[] = [
    { valor: 'masculino', etiqueta: 'Masculino' },
    { valor: 'femenino', etiqueta: 'Femenino' },
    { valor: 'otros', etiqueta: 'Otros' },
  ];

  get puestosDisponibles(): readonly Puesto[] {
    return this.auth.sesion()?.puesto === 'dueño' ? PUESTOS_TODOS : PUESTOS_CREABLES_POR_SUPERVISOR;
  }

  readonly form: FormGroup = this.fb.group(
    {
      nombre: ['', [Validators.required, validadorTextoValido(4)]],
      apellido: ['', [Validators.required, validadorTextoValido(4)]],
      sexo: [null, Validators.required],
      fecha_nacimiento: ['', [Validators.required, validadorFechaNacimiento()]],
      cuil: ['', [Validators.required, validadorCuil()]],
      email: ['', [Validators.required, validadorEmailValido()]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmarPassword: ['', Validators.required],
      puesto: [null, Validators.required],
    },
    { validators: validadorPasswordsCoinciden('password', 'confirmarPassword') }
  );

  mensajeError(campo: CampoTexto | 'sexo' | 'fecha_nacimiento' | 'puesto'): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    const tipoError = Object.keys(control.errors)[0];
    return MENSAJES_ERROR[campo]?.[tipoError] ?? null;
  }

  mensajeErrorPasswordsNoCoinciden(): string | null {
    const confirmar = this.form.get('confirmarPassword');
    if (!confirmar?.touched) return null;
    return this.form.errors?.['passwordsNoCoinciden'] ? 'Las contraseñas no coinciden.' : null;
  }

  async onBlurTexto(campo: CampoTexto): Promise<void> {
    const mensaje = this.mensajeError(campo);
    if (mensaje) {
      await this.avisos.error(mensaje);
      return;
    }

    if (campo === 'cuil') {
      const control = this.form.get('cuil');
      const valor = control?.value?.trim();
      if (valor && !control?.errors) {
        const existe = await this.empleadosService.existeCuil(valor);
        if (existe) {
          control?.setErrors({ cuilDuplicado: true });
          await this.avisos.error(MENSAJES_ERROR['cuil']['cuilDuplicado']);
        }
      }
    }

    if (campo === 'email') {
      const control = this.form.get('email');
      const valor = control?.value?.trim();
      if (valor && !control?.errors) {
        const existe = await this.empleadosService.existeEmail(valor);
        if (existe) {
          control?.setErrors({ emailDuplicado: true });
          await this.avisos.error(MENSAJES_ERROR['email']['emailDuplicado']);
        }
      }
    }
  }

  async tomarFoto(): Promise<void> {
    if (this.tomandoFoto) return;
    this.tomandoFoto = true;
    try {
      const resultado = await this.camara.tomarFoto();
      if (resultado.ok && resultado.dataUrl) {
        this.fotoDataUrl.set(resultado.dataUrl);
      } else if (!resultado.cancelado) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo tomar la foto.');
      }
    } finally {
      this.tomandoFoto = false;
    }
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
        sexo: d.sexo ?? this.form.value.sexo,
        fecha_nacimiento: d.fechaNacimiento ?? this.form.value.fecha_nacimiento,
        cuil: d.cuilSugerido ?? this.form.value.cuil,
      });

      await this.avisos.info('Datos completados desde el DNI. Revisalos antes de guardar.');
    } finally {
      this.escaneando = false;
    }
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      await this.avisos.error('Revisá los campos marcados antes de continuar.');
      return;
    }

    if (!this.fotoDataUrl()) {
      await this.avisos.error('Tomá una foto del empleado antes de guardar.');
      return;
    }

    if (this.cargando) return;
    this.cargando = true;
    this.loading.mostrar();

    try {
      const { nombre, apellido, sexo, fecha_nacimiento, cuil, email, password, puesto } = this.form.getRawValue();

      if (!this.puestosDisponibles.includes(puesto)) {
        await this.avisos.error('No tenés permisos para crear un empleado con ese puesto.');
        this.cargando = false;
        return;
      }

      const [cuilExiste, emailExiste] = await Promise.all([
        this.empleadosService.existeCuil(cuil),
        this.empleadosService.existeEmail(email),
      ]);

      if (cuilExiste) {
        this.form.get('cuil')?.setErrors({ cuilDuplicado: true });
        await this.avisos.error(MENSAJES_ERROR['cuil']['cuilDuplicado']);
        return;
      }
      if (emailExiste) {
        this.form.get('email')?.setErrors({ emailDuplicado: true });
        await this.avisos.error(MENSAJES_ERROR['email']['emailDuplicado']);
        return;
      }

      const correo = email.trim().toLowerCase();

      // 1) Crear el usuario en Supabase Auth vía Edge Function mínima
      const resultadoAuth = await this.empleadosService.crearUsuarioAuth(correo, password);

      if (!resultadoAuth.ok || !resultadoAuth.userId) {
        await this.avisos.error(resultadoAuth.mensaje ?? 'No se pudo crear el usuario.');
        return;
      }

      // 2) Subir la foto a Storage (bucket "empleado"), nombrada con el CUIL.
      const nombreArchivo = `${cuil}.jpg`;
      const fotoBlob = await (await fetch(this.fotoDataUrl()!)).blob();

      const { error: storageError } = await this.supabase.client.storage
        .from('empleado')
        .upload(nombreArchivo, fotoBlob, { contentType: 'image/jpeg', upsert: false });

      if (storageError) {
        await this.avisos.error(`Error al subir foto: ${storageError.message}`);
        return;
      }

      // 3) Insertar la fila del empleado, vinculada al usuario de Auth recién creado.
      const { error: insertError } = await this.supabase.client.from('empleados').insert({
        auth_user_id: resultadoAuth.userId,
        estado: 'On',
        nombre,
        apellido,
        sexo,
        fecha_nacimiento,
        cuil,
        email: correo,
        puesto,
        foto: nombreArchivo,
      });

      if (insertError) {
        await this.avisos.error(`Error al guardar empleado: ${insertError.message}`);
        return;
      }

      // Sin toast verde acá: la confirmación la da la notificación push
      // (notificarCreacion, abajo). Los toasts de avisos.error() siguen
      // intactos para cuando algo falla.

      // Notificación push a dueño/supervisor avisando del alta nueva.
      this.notificaciones.notificarCreacion(
        'Nuevo empleado creado',
        `${nombre} ${apellido} fue dado de alta como ${puesto}.`,
        { puestos: ['dueño', 'supervisor'], ruta: '/administracion/personal' }
      );

      this.form.reset();
      this.fotoDataUrl.set(null);
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }
}

