import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ActionSheetButton, IonActionSheet, IonButton, IonContent, IonInput, IonItem, IonLabel, IonText } from '@ionic/angular/standalone'
import { MarcaHeaderComponent } from '../../../shared/components/marca-header/marca-header.component';
import { USUARIOS_DEMO, UsuarioDemo } from '../../../core/usuarios-demo';
import { AvisosService } from '../../../core/services/avisos.service';
import { Auth } from '../../../core/services/auth';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';

// Definida con el equipo
const PASSWORD_MIN_LENGTH = 6;

type CampoLogin = 'email' | 'password';

// Mensajes de error
const MENSAJES_ERROR: Record<CampoLogin, Record<string, string>> = {
  email: {
    required: 'Ingresá tu correo electrónico.',
    email: 'El correo ingresado no es válido.',
  },
  password: {
    required: 'Ingresá tu clave.',
    minlength: `La clave debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`,
  },
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, IonContent, IonItem, IonLabel, IonText, IonInput, IonButton, IonActionSheet, MarcaHeaderComponent],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly auth = inject(Auth);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  mostrarAccesoRapido = false;
  cargando = false;

  /**
   * Si ya hay una sesión activa (empleado o cliente aprobado) y alguien
   * entra a /login igual — por ejemplo, tipeando la URL a mano, o
   * volviendo con el botón "atrás" — lo mandamos directo a su pantalla
   * en vez de mostrarle el formulario de nuevo.
   */
  async ngOnInit(): Promise<void> {
    await this.auth.redirigirSiYaHaySesion();
  }

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
  });

  readonly botonesAccesoRapido: ActionSheetButton[] = [
    ...USUARIOS_DEMO.map((usuario): ActionSheetButton => ({
      text: usuario.etiqueta,
      handler: () => this.autocompletar(usuario),
    })),
    { text: 'Cancelar', role: 'cancel' },
  ];

  autocompletar(usuario: UsuarioDemo): void {
    this.form.patchValue({ email: usuario.email, password: usuario.password });
  }

  mensajeError(campo: CampoLogin): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) {
      return null;
    }
    const tipoError = Object.keys(control.errors)[0];
    return MENSAJES_ERROR[campo][tipoError] ?? null;
  }

  onBlur(campo: CampoLogin): void {
    const mensaje = this.mensajeError(campo);
    if (mensaje) {
      this.avisos.error(mensaje);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const mensaje = this.mensajeError('email') ?? this.mensajeError('password');
      if (mensaje) {
        await this.avisos.error(mensaje);
      }
      return;
    }

    if (this.cargando) {
      return;
    }

    this.cargando = true;
    this.loading.mostrar();
    const { email, password } = this.form.getRawValue();

    try {
      const resultado = await this.auth.login(email, password);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo iniciar sesión.');
        return;
      }

      if (resultado.tipo === 'cliente') {
        // Cliente aprobado: no pasa por rutaHomeSegunPuesto (eso es solo
        // para empleados) — va directo a su propia landing. También
        // registra el token de push: el mozo le avisa si rechaza su pedido.
        this.notificaciones.guardarTokenPendienteSiHaySesion();
        this.router.navigate(['/cliente'], { replaceUrl: true });
        return;
      }

      // Recién ahora hay sesión: si Firebase ya nos había dado un token
      // antes (al arrancar la app), lo guardamos en push_tokens ahora.
      this.notificaciones.guardarTokenPendienteSiHaySesion();

      // inicioGuard decide a dónde va cada uno según su puesto
      // (administración, cocina, cantina, etc.) — ver rutas-por-puesto.ts
      this.router.navigate(['/inicio'], { replaceUrl: true });
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }
}
