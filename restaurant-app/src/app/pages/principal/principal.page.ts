import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cameraOutline } from 'ionicons/icons';
import { AlturaDisponibleDirective } from '../../shared/directives/altura-disponible.directive';
import { AvisoCampoComponent } from '../../shared/components/aviso-campo/aviso-campo.component';
import { BarraAccionesComponent } from '../../shared/components/barra-acciones/barra-acciones.component';
import { AvisosService } from '../../core/services/avisos.service';
import { CamaraService } from '../../core/services/camara.service';
import { ClienteAnonimoService } from '../../core/services/cliente-anonimo.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { LoadingService } from '../../core/services/loading.service';
import { validadorTextoValido } from '../../validators/empleado.validators';
import { validarFormulario } from '../../core/utils/formularios';

@Component({
  selector: 'app-principal',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonButton,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonInput,
    IonTitle,
    IonToolbar,
    AlturaDisponibleDirective,
    AvisoCampoComponent,
    BarraAccionesComponent,
  ],
  templateUrl: './principal.page.html',
  styleUrls: ['./principal.page.scss'],
})
export class PrincipalPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  protected readonly camara = inject(CamaraService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly mensajesNombre = {
    required: 'Ingresá tu nombre.',
    soloEspacios: 'El nombre no puede estar vacío.',
    minlength: 'El nombre debe tener al menos 2 caracteres.',
    soloTexto: 'El nombre solo puede contener letras.',
  };
  readonly mensajesApellido = {
    required: 'Ingresá tu apellido.',
    soloEspacios: 'El apellido no puede estar vacío.',
    minlength: 'El apellido debe tener al menos 2 caracteres.',
    soloTexto: 'El apellido solo puede contener letras.',
  };

  /** true mientras se decide si hay que mostrar el form o saltar directo. */
  readonly verificando = signal(true);
  readonly fotoDataUrl = signal<string | null>(null);
  cargando = false;

  readonly form: FormGroup = this.fb.group({
    nombre: ['', [Validators.required, validadorTextoValido(2)]],
    apellido: ['', [Validators.required, validadorTextoValido(2)]],
  });

  constructor() {
    addIcons({ cameraOutline });
  }

  async ngOnInit(): Promise<void> {
    const cliente = await this.clienteAnonimo.obtenerClienteActual();

    if (cliente) {
      // Ya se había registrado antes en este dispositivo: no le volvemos
      // a pedir nada. De paso, refrescamos su push token por si cambió.
      await this.clienteAnonimo.registrarPushToken(cliente.id);
      this.router.navigate(['/cliente/inicio'], { replaceUrl: true });
      return;
    }

    this.verificando.set(false);
  }

  async tomarFoto(): Promise<void> {
    const foto = await this.camara.tomarFotoConAviso();
    if (foto) this.fotoDataUrl.set(foto);
  }

  volverATomarFoto(): void {
    this.fotoDataUrl.set(null);
  }

  cancelarRegistro(): void {
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }

  async onSubmit(): Promise<void> {
    if (this.cargando) return;

    if (!(await validarFormulario(this.form, this.avisos, this.el.nativeElement))) return;

    if (!this.fotoDataUrl()) {
      await this.avisos.error('Tomá una foto antes de continuar.');
      return;
    }

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

      this.router.navigate(['/cliente/inicio'], { replaceUrl: true });
    } finally {
      this.cargando = false;
      this.loading.ocultar();
    }
  }
}