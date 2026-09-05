import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ActionSheetButton, IonActionSheet, IonButton, IonContent, IonInput, IonItem, IonLabel, IonText } from '@ionic/angular';
import { MarcaHeaderComponent } from '../../../shared/components/marca-header/marca-header.component';
import { USUARIOS_DEMO, UsuarioDemo } from '../../../core/usuarios-demo';
import { AvisosService } from '../../../core/services/avisos.service';

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
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);

  mostrarAccesoRapido = false;
  cargando = false;

  readonly form: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(PASSWORD_MIN_LENGTH)]],
  });

  // Menú inferior "solo para esta demo": cada boton carga el email/password de un usuario de prueba.
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

  // Solo se muestra una vez que el usuario tocó el campo, y solo el primer error activo
  // (nunca un mensaje genérico tipo "Error").
  mensajeError(campo: CampoLogin): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) {
      return null;
    }
    const tipoError = Object.keys(control.errors)[0];
    return MENSAJES_ERROR[campo][tipoError] ?? null;
  }

  // Vibra al salir de un campo inválido (blur), nunca en cada tecla presionada.
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

    this.cargando = true;
    this.router.navigate(['/principal'], { replaceUrl: true });
  }
}
