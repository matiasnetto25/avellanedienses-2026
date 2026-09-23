import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { AvisosService } from '../../../../core/services/avisos.service';
import { CamaraService } from '../../../../core/services/camara.service';
import { MesasService } from '../../../../core/services/mesas.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { TIPOS_MESA, MesaRow } from '../../../../core/models/mesa.model';

@Component({
  selector: 'app-crear-mesa',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
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
  templateUrl: './crear-mesa.page.html',
  styleUrls: ['./crear-mesa.page.scss'],
})
export class CrearMesaPage {
  private readonly fb = inject(FormBuilder);
  private readonly avisos = inject(AvisosService);
  private readonly camara = inject(CamaraService);
  private readonly mesasService = inject(MesasService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  readonly tiposMesa = TIPOS_MESA;

  cargando = false;
  tomandoFoto = false;

  readonly fotoDataUrl = signal<string | null>(null);
  /** URL pública del QR ya persistido en Storage (se llena después de crear la mesa) */
  readonly urlQr = signal<string | null>(null);
  readonly mesaCreada = signal<MesaRow | null>(null);

  readonly form: FormGroup = this.fb.group({
    numero_mesa: ['', [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    cant_comensales: ['', [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    tipo: [null, Validators.required],
  });

  mensajeError(campo: 'numero_mesa' | 'cant_comensales' | 'tipo'): string | null {
    const control = this.form.get(campo);
    if (!control || !control.touched || !control.errors) return null;

    if (control.errors['required']) return 'Este campo es obligatorio.';
    if (control.errors['pattern']) return 'Ingresá un número entero válido.';
    if (control.errors['min']) return 'El valor debe ser mayor a 0.';
    if (control.errors['numeroDuplicado']) return 'El número de mesa ingresado ya existe. Elegí otro número.';
    return null;
  }

  async onBlurNumero(): Promise<void> {
    const control = this.form.get('numero_mesa');
    const valor = Number(control?.value);
    if (control?.errors || !valor) return;

    const existe = await this.mesasService.existeNumero(valor);
    if (existe) {
      control?.setErrors({ numeroDuplicado: true });
      await this.avisos.error('El número de mesa ingresado ya existe. Elegí otro número.');
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

  async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      await this.avisos.error('Revisá los campos marcados antes de continuar.');
      return;
    }

    if (!this.fotoDataUrl()) {
      await this.avisos.error('Tomá una foto de la mesa antes de crearla.');
      return;
    }

    if (this.cargando) return;
    this.cargando = true;
    this.loading.mostrar();

    try {
      const numero_mesa = Number(this.form.value.numero_mesa);
      const cant_comensales = Number(this.form.value.cant_comensales);
      const tipo = this.form.value.tipo;

      const existe = await this.mesasService.existeNumero(numero_mesa);
      if (existe) {
        this.form.get('numero_mesa')?.setErrors({ numeroDuplicado: true });
        await this.avisos.error('El número de mesa ingresado ya existe. Elegí otro número.');
        return;
      }

      const resultado = await this.mesasService.crearMesa(
        { numero_mesa, cant_comensales, tipo },
        this.fotoDataUrl()!
      );

      if (!resultado.ok || !resultado.mesa) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo crear la mesa.');
        return;
      }

      // No hace falta un toast acá: la pantalla de éxito de abajo (con el
      // QR) ya confirma visualmente que la mesa se creó — mostrar además
      // un toast de "Mesa creada correctamente" quedaba redundante,
      // encimado con el toast de la notificación push.
      this.mesaCreada.set(resultado.mesa);
      this.urlQr.set(this.mesasService.obtenerUrlQr(resultado.mesa.qr));

      this.notificaciones.notificarCreacion(
        'Nueva mesa creada',
        `Se creó la Mesa ${resultado.mesa.numero_mesa}.`,
        { ruta: '/administracion/salon/gestion' }
      );

      this.form.reset();
      this.fotoDataUrl.set(null);
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }

  crearOtraMesa(): void {
    this.urlQr.set(null);
    this.mesaCreada.set(null);
  }
}
