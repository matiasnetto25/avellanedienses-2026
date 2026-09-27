import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonItem, IonLabel, IonInput } from '@ionic/angular/standalone';
import { AvisosService } from '../../core/services/avisos.service';
import { CamaraService } from '../../core/services/camara.service';
import { ClienteAnonimoService } from '../../core/services/cliente-anonimo.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { LoadingService } from '../../core/services/loading.service';
import { validadorTextoValido } from '../../validators/empleado.validators';

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, IonContent, IonButton, IonItem, IonLabel, IonInput],
  templateUrl: './principal.page.html',
  styleUrls: ['./principal.page.scss'],
})
export class PrincipalPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly camara = inject(CamaraService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  /** true mientras se decide si hay que mostrar el form o saltar directo. */
  readonly verificando = signal(true);
  readonly fotoDataUrl = signal<string | null>(null);
  tomandoFoto = false;
  cargando = false;

  readonly form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, validadorTextoValido(2)]],
    apellido: ['', [Validators.required, validadorTextoValido(2)]],
  });

  async ngOnInit(): Promise<void> {
    const cliente = await this.clienteAnonimo.obtenerClienteActual();

    if (cliente) {
      // Ya se había registrado antes en este dispositivo: no le volvemos
      // a pedir nada. De paso, refrescamos su push token por si cambió.
      await this.clienteAnonimo.registrarPushToken(cliente.id);
      this.router.navigate(['/cliente-anonimo'], { replaceUrl: true });
      return;
    }

    this.verificando.set(false);
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

  cancelarRegistro(): void {
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      await this.avisos.error('Ingresá tu nombre y apellido.');
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
      const { nombre, apellido } = this.form.getRawValue();
      const resultado = await this.clienteAnonimo.registrarAnonimo(nombre, apellido, this.fotoDataUrl()!);

      if (!resultado.ok || !resultado.clienteId) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo registrar.');
        return;
      }

      this.notificaciones.avisarClienteAnonimoIngreso(nombre, apellido);

      this.router.navigate(['/cliente-anonimo'], { replaceUrl: true });
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }
}
