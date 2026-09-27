import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonText,
  IonIcon,
} from '@ionic/angular/standalone';
import { Auth } from '../../core/services/auth';
import { AvisosService } from '../../core/services/avisos.service';
import { CamaraService } from '../../core/services/camara.service';
import { DniScannerService } from '../../core/services/scanDNI.service';
import { ClientesService } from '../../core/services/clientes.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { LoadingService } from '../../core/services/loading.service';
import { validadorEmailValido, validadorTextoValido } from '../../validators/empleado.validators';
import { validadorDni } from '../../validators/cliente.validators';

type CampoTexto = 'nombre' | 'apellido' | 'dni' | 'email' | 'password';

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
  dni: {
    required: 'Ingresá el DNI.',
    formatoDni: 'El DNI debe tener entre 7 y 8 números, sin puntos ni letras.',
    dniDuplicado: 'Ese DNI ya pertenece a un cliente registrado.',
  },
  email: {
    required: 'Ingresá el email.',
    email: 'El email ingresado no es válido.',
    emailDuplicado: 'Ese email ya pertenece a un cliente registrado.',
  },
  password: {
    required: 'Ingresá una contraseña.',
    minlength: 'La contraseña debe tener al menos 6 caracteres.',
  },
};

@Component({
  selector: 'app-registrar-cliente',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonText,
    IonIcon,
  ],
  templateUrl: './registrar-cliente.page.html',
  styleUrls: ['./registrar-cliente.page.scss'],
})
export class RegistrarClientePage {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(Auth);
  private readonly avisos = inject(AvisosService);
  private readonly camara = inject(CamaraService);
  private readonly dniScanner = inject(DniScannerService);
  private readonly clientesService = inject(ClientesService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  cargando = false;
  escaneando = false;
  tomandoFoto = false;

  readonly fotoDataUrl = signal<string | null>(null);
  readonly registroExitoso = signal(false);

  /** El mismo formulario sirve para el auto-registro y para cuando lo carga el metre. */
  get esMetre(): boolean {
    return this.auth.sesion()?.puesto === 'metre';
  }

  get rutaVolver(): string {
    return this.esMetre ? '/metre' : '/bienvenida';
  }

  volver(): void {
    this.router.navigate([this.rutaVolver]);
  }

  readonly form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, validadorTextoValido(4)]],
    apellido: ['', [Validators.required, validadorTextoValido(4)]],
    dni: ['', [Validators.required, validadorDni()]],
    email: ['', [Validators.required, validadorEmailValido()]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  mensajeError(campo: CampoTexto): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;
    const tipoError = Object.keys(control.errors)[0];
    return MENSAJES_ERROR[campo]?.[tipoError] ?? null;
  }

  async onBlurTexto(campo: CampoTexto): Promise<void> {
    const mensaje = this.mensajeError(campo);
    if (mensaje) {
      await this.avisos.error(mensaje);
      return;
    }

    if (campo === 'dni') {
      const control = this.form.get('dni');
      const valor = control?.value?.trim();
      if (valor && !control?.errors) {
        const existe = await this.clientesService.existeDni(valor);
        if (existe) {
          control?.setErrors({ dniDuplicado: true });
          await this.avisos.error(MENSAJES_ERROR['dni']['dniDuplicado']);
        }
      }
    }

    if (campo === 'email') {
      const control = this.form.get('email');
      const valor = control?.value?.trim();
      if (valor && !control?.errors) {
        const existe = await this.clientesService.existeEmail(valor);
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

  /** Reutiliza el mismo lector ML Kit / PDF417 que ya usa el alta de empleados. */
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
      await this.avisos.error('Tomá una foto antes de continuar.');
      return;
    }

    if (this.cargando) return;
    this.cargando = true;
    this.loading.mostrar();

    try {
      const { nombre, apellido, dni, email, password } = this.form.getRawValue();
      const correo = (email as string).trim().toLowerCase();

      const [dniExiste, emailExiste] = await Promise.all([
        this.clientesService.existeDni(dni),
        this.clientesService.existeEmail(correo),
      ]);

      if (dniExiste) {
        this.form.get('dni')?.setErrors({ dniDuplicado: true });
        await this.avisos.error(MENSAJES_ERROR['dni']['dniDuplicado']);
        return;
      }
      if (emailExiste) {
        this.form.get('email')?.setErrors({ emailDuplicado: true });
        await this.avisos.error(MENSAJES_ERROR['email']['emailDuplicado']);
        return;
      }

      const resultado = await this.clientesService.crearClienteRegistrado(
        { nombre, apellido, dni, email: correo, password },
        this.fotoDataUrl()!
      );

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo registrar el cliente.');
        return;
      }

      // Sin toast verde: la confirmación la da la push (ver
      // NotificacionesService.avisarNuevoClientePendiente).
      this.notificaciones.avisarNuevoClientePendiente(nombre, apellido, this.esMetre);

      this.form.reset();
      this.fotoDataUrl.set(null);

      if (this.esMetre) {
        this.router.navigate(['/metre']);
      } else {
        this.registroExitoso.set(true);
      }
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }

  volverAInicio(): void {
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }
}
