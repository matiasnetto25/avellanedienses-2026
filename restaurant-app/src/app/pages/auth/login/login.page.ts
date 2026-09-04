import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ActionSheetButton, IonActionSheet, IonButton, IonContent, IonInput, IonItem, IonLabel } from '@ionic/angular';
import { MarcaHeaderComponent } from '../../../shared/marca-header/marca-header.component';
import { USUARIOS_DEMO, UsuarioDemo } from '../../../core/usuarios-demo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, IonContent, IonItem, IonLabel, IonInput, IonButton, IonActionSheet, MarcaHeaderComponent],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  mostrarAccesoRapido = false;

  // TODO: spec 5 - agregar Validators (required, email, longitud mínima) a estos controles.
  readonly form: FormGroup = this.fb.group({
    email: [''],
    password: [''],
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

  async onSubmit(): Promise<void> {
    this.router.navigate(['/principal'], { replaceUrl: true });
  }
}
