import { Component, ElementRef, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ActionSheetButton, IonActionSheet, IonButton, IonContent, IonInput, IonItem, IonLabel } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../../../shared/components/marca-header/marca-header.component';
import { AvisoCampoComponent } from '../../../shared/components/aviso-campo/aviso-campo.component';
import { USUARIOS_DEMO, UsuarioDemo } from '../../../core/usuarios-demo';
import { AvisosService } from '../../../core/services/avisos.service';
import { Auth } from '../../../core/services/auth';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { validarFormulario } from '../../../core/utils/formularios';

// Definida con el equipo
const PASSWORD_MIN_LENGTH = 6;

// Mensajes propios; los que no están acá salen de los default de app-aviso-campo.
const MENSAJES_EMAIL = { required: 'Escribí tu correo electrónico.' };
const MENSAJES_PASSWORD = { required: 'Escribí tu contraseña.' };

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, IonContent, IonItem, IonLabel, IonInput, IonButton, IonActionSheet, MarcaHeaderComponent, AvisoCampoComponent],
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
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly mensajesEmail = MENSAJES_EMAIL;
  readonly mensajesPassword = MENSAJES_PASSWORD;

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

  async onSubmit(): Promise<void> {
    if (this.cargando) {
      return;
    }
    if (!(await validarFormulario(this.form, this.avisos, this.el.nativeElement))) {
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
