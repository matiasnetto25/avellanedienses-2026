import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cameraOutline } from 'ionicons/icons';
import { AlturaDisponibleDirective } from '../../../../shared/directives/altura-disponible.directive';
import { AvisoCampoComponent } from '../../../../shared/components/aviso-campo/aviso-campo.component';
import { BarraAccionesComponent } from '../../../../shared/components/barra-acciones/barra-acciones.component';
import { AvisosService } from '../../../../core/services/avisos.service';
import { CamaraService } from '../../../../core/services/camara.service';
import { MesasService } from '../../../../core/services/mesas.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { TIPOS_MESA, MesaRow } from '../../../../core/models/mesa.model';
import { validarFormulario } from '../../../../core/utils/formularios';

@Component({
  selector: 'app-crear-mesa',
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
  templateUrl: './crear-mesa.page.html',
  styleUrls: ['./crear-mesa.page.scss'],
})
export class CrearMesaPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly avisos = inject(AvisosService);
  protected readonly camara = inject(CamaraService);
  private readonly mesasService = inject(MesasService);
  private readonly loading = inject(LoadingService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly tiposMesa = TIPOS_MESA;

  /** Mensajes propios de cada campo (los demás salen de app-aviso-campo). */
  readonly mensajesNumero = {
    pattern: 'Ingresá un número entero, sin decimales.',
    numeroDuplicado: 'Ese número ya pertenece a otra mesa. Elegí otro.',
  };
  readonly mensajesComensales = { pattern: 'Ingresá un número entero, sin decimales.' };

  cargando = false;

  readonly fotoDataUrl = signal<string | null>(null);
  /** URL pública del QR ya persistido en Storage (se llena después de crear la mesa) */
  readonly urlQr = signal<string | null>(null);
  readonly mesaCreada = signal<MesaRow | null>(null);
  /** El número libre más bajo (con las mesas 1, 2 y 5 creadas, el 3). */
  private readonly numeroSugerido = signal<number | null>(null);

  readonly form: FormGroup = this.fb.group({
    numero_mesa: ['', [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    cant_comensales: ['', [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    tipo: [null, Validators.required],
  });

  constructor() {
    addIcons({ cameraOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.sugerirNumero();
  }

  /** Completa el número de mesa con el primer número libre; se puede cambiar. */
  private async sugerirNumero(): Promise<void> {
    const numero = await this.mesasService.sugerirNumero();
    this.numeroSugerido.set(numero);

    const control = this.form.get('numero_mesa');
    if (numero !== null && control && !control.value) {
      control.setValue(String(numero));
    }
  }

  /** Ayuda debajo del campo: solo mientras el valor sea el sugerido. */
  ayudaNumero(): string | undefined {
    const sugerido = this.numeroSugerido();
    const actual = Number(this.form.get('numero_mesa')?.value);
    return sugerido !== null && actual === sugerido ? `Sugerido: es el primer número libre.` : undefined;
  }

  async onBlurNumero(): Promise<void> {
    const control = this.form.get('numero_mesa');
    const valor = Number(control?.value);
    if (control?.errors || !valor) return;

    const existe = await this.mesasService.existeNumero(valor);
    if (existe) {
      // El mensaje lo muestra app-aviso-campo debajo del campo.
      control?.setErrors({ numeroDuplicado: true });
    }
  }

  async tomarFoto(): Promise<void> {
    const foto = await this.camara.tomarFotoConAviso();
    if (foto) this.fotoDataUrl.set(foto);
  }

  volverATomarFoto(): void {
    this.fotoDataUrl.set(null);
  }

  async onSubmit(): Promise<void> {
    if (this.cargando) return;

    if (!(await validarFormulario(this.form, this.avisos, this.el.nativeElement))) return;

    if (!this.fotoDataUrl()) {
      await this.avisos.error('Tomá una foto de la mesa antes de crearla.');
      return;
    }

    this.cargando = true;
    this.loading.mostrar();

    try {
      const numero_mesa = Number(this.form.value.numero_mesa);
      const cant_comensales = Number(this.form.value.cant_comensales);
      const tipo = this.form.value.tipo;

      const existe = await this.mesasService.existeNumero(numero_mesa);
      if (existe) {
        this.form.get('numero_mesa')?.setErrors({ numeroDuplicado: true });
        this.form.get('numero_mesa')?.markAsTouched();
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

      // La pantalla de éxito (con el QR) confirma al que la creó; la push
      // avisa a dueño y supervisor.
      this.notificaciones.avisarMesaCreada(resultado.mesa.numero_mesa);
      this.mesaCreada.set(resultado.mesa);
      this.urlQr.set(this.mesasService.obtenerUrlQr(resultado.mesa.qr));

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
    void this.sugerirNumero();
  }
}