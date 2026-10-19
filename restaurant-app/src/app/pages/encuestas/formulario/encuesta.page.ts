import { Component, ElementRef, inject, signal } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonRadio,
  IonRadioGroup,
  IonRange,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { star, starOutline } from 'ionicons/icons';
import {
  AspectoDestacado,
  AtencionMozo,
  CALIFICACION_MAX,
  CALIFICACION_MIN,
  COMENTARIO_MAX,
  ETIQUETAS_ASPECTO,
  ETIQUETAS_ATENCION_MOZO,
  LIMPIEZA_MAX,
  LIMPIEZA_MIN,
  OPCIONES_ASPECTO,
  OPCIONES_ATENCION_MOZO,
} from '../../../core/models/encuesta.model';
import { AvisosService } from '../../../core/services/avisos.service';
import { EncuestasService } from '../../../core/services/encuestas.service';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';
import { LoadingService } from '../../../core/services/loading.service';
import { validarFormulario } from '../../../core/utils/formularios';
import { AvisoCampoComponent } from '../../../shared/components/aviso-campo/aviso-campo.component';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';

/** Al menos un aspecto marcado. La base tiene la misma regla (encuestas_aspectos_check). */
function alMenosUno(control: AbstractControl): ValidationErrors | null {
  return (control.value as unknown[]).length > 0 ? null : { alMenosUno: true };
}

/**
 * Encuesta de satisfacción del cliente (punto 20, issue 03): seis preguntas,
 * cada tipo con su propio control (estrellas, radio, slider, checkboxes,
 * toggle y área de texto), como pide la consigna.
 *
 * Se entra con encuestaGuard: con la encuesta habilitada y todavía sin
 * completar en esta estadía.
 */
@Component({
  selector: 'app-encuesta',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonCheckbox,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonRadio,
    IonRadioGroup,
    IonRange,
    IonTextarea,
    IonTitle,
    IonToggle,
    IonToolbar,
    AlturaDisponibleDirective,
    AvisoCampoComponent,
    BarraAccionesComponent,
  ],
  templateUrl: './encuesta.page.html',
  styleUrls: ['./encuesta.page.scss'],
})
export class EncuestaPage {
  private readonly encuestas = inject(EncuestasService);
  private readonly etapaCliente = inject(EtapaClienteService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly estrellas = Array.from({ length: CALIFICACION_MAX - CALIFICACION_MIN + 1 }, (_, i) => i + CALIFICACION_MIN);
  readonly opcionesAtencion = OPCIONES_ATENCION_MOZO;
  readonly etiquetasAtencion = ETIQUETAS_ATENCION_MOZO;
  readonly opcionesAspecto = OPCIONES_ASPECTO;
  readonly etiquetasAspecto = ETIQUETAS_ASPECTO;
  readonly limpiezaMin = LIMPIEZA_MIN;
  readonly limpiezaMax = LIMPIEZA_MAX;
  readonly comentarioMax = COMENTARIO_MAX;

  /** Mensajes de cada pregunta para app-aviso-campo. */
  readonly mensajes = {
    calificacionGeneral: { required: 'Elegí de 1 a 5 estrellas.' },
    atencionMozo: { required: 'Elegí cómo te atendió el mozo.' },
    limpieza: { required: 'Mové el control para calificar la limpieza.' },
    aspectosDestacados: { alMenosUno: 'Marcá al menos una opción.' },
  };

  readonly form = new FormGroup({
    calificacionGeneral: new FormControl<number | null>(null, Validators.required),
    atencionMozo: new FormControl<AtencionMozo | null>(null, Validators.required),
    // ion-range siempre muestra un valor: el control queda en null hasta que
    // el cliente lo mueve, así se distingue «sin responder» de un 5 elegido.
    limpieza: new FormControl<number | null>(null, Validators.required),
    aspectosDestacados: new FormControl<AspectoDestacado[]>([], { nonNullable: true, validators: alMenosUno }),
    recomendaria: new FormControl<boolean>(false, { nonNullable: true }),
    comentario: new FormControl<string>('', { nonNullable: true, validators: Validators.maxLength(COMENTARIO_MAX) }),
  });

  readonly enviando = signal(false);

  constructor() {
    addIcons({ star, starOutline });
  }

  calificar(estrellas: number): void {
    const control = this.form.controls.calificacionGeneral;
    control.setValue(estrellas);
    control.markAsTouched();
  }

  /** Lo llaman ionChange e ionKnobMoveEnd: así también cuenta soltar el control en el mismo valor. */
  calificarLimpieza(valor: unknown): void {
    if (typeof valor !== 'number') return;
    const control = this.form.controls.limpieza;
    control.setValue(valor);
    control.markAsTouched();
  }

  alternarAspecto(aspecto: AspectoDestacado, marcado: boolean): void {
    const control = this.form.controls.aspectosDestacados;
    const sinElAspecto = control.value.filter((a) => a !== aspecto);
    // Se reconstruye en el orden de las opciones, no en el orden en que se marcaron.
    const elegidos = marcado ? [...sinElAspecto, aspecto] : sinElAspecto;
    control.setValue(this.opcionesAspecto.filter((a) => elegidos.includes(a)));
    control.markAsTouched();
  }

  async enviar(): Promise<void> {
    if (this.enviando()) return;
    if (!(await validarFormulario(this.form, this.avisos, this.el.nativeElement))) return;

    const etapa = this.etapaCliente.etapa();
    if (etapa?.tipo !== 'estadia') {
      await this.avisos.error('Necesitás estar en tu mesa para completar la encuesta.');
      return;
    }

    const valores = this.form.getRawValue();
    this.enviando.set(true);
    try {
      const resultado = await this.loading.envolver(
        this.encuestas.crear(etapa.solicitud.id, {
          calificacionGeneral: valores.calificacionGeneral!,
          atencionMozo: valores.atencionMozo!,
          limpieza: valores.limpieza!,
          aspectosDestacados: valores.aspectosDestacados,
          recomendaria: valores.recomendaria,
          comentario: valores.comentario.trim() || null,
        })
      );
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo enviar la encuesta.');
        return;
      }
      await this.avisos.exito('¡Gracias por tu opinión!');
      // Sin volver atrás al formulario. Con la pantalla de resultados (issue 05), va ahí.
      await this.router.navigate(['/cliente/inicio'], { replaceUrl: true });
    } finally {
      this.enviando.set(false);
    }
  }
}
