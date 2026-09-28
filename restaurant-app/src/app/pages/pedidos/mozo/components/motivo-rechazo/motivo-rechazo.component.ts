import { AfterViewInit, Component, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { IonButton } from '@ionic/angular/standalone';
import { MOTIVO_RECHAZO_MAX, validarMotivoRechazo } from '../../../../../core/models/pedido.model';
import { AvisosService } from '../../../../../core/services/avisos.service';

/** Validador de formulario a partir de la regla del modelo (la misma que usa PedidosService). */
function motivoRechazoValidator(control: AbstractControl<string>): ValidationErrors | null {
  const error = validarMotivoRechazo(control.value ?? '');
  return error ? { motivo: error } : null;
}

/**
 * Contenido del modal con el que el mozo rechaza un pedido: la mesa, el
 * motivo y los botones. Valida el motivo y emite el texto; el rechazo lo
 * hace la página. La ventana que lo contiene (.motivo-modal: ancho,
 * bordes, fondo) la define la página que abre el <ion-modal>.
 */
@Component({
  selector: 'app-motivo-rechazo',
  standalone: true,
  imports: [ReactiveFormsModule, IonButton],
  templateUrl: './motivo-rechazo.component.html',
  styleUrls: ['./motivo-rechazo.component.scss'],
})
export class MotivoRechazoComponent implements AfterViewInit {
  private readonly avisos = inject(AvisosService);

  @Input({ required: true }) numeroMesa!: number;
  /** true mientras se rechaza: deshabilita el campo y los botones. */
  @Input() procesando = false;

  @Output() cancelar = new EventEmitter<void>();
  /** El motivo ya validado. */
  @Output() confirmar = new EventEmitter<string>();

  @ViewChild('campo') private campo?: ElementRef<HTMLTextAreaElement>;

  readonly maximo = MOTIVO_RECHAZO_MAX;
  readonly motivo = new FormControl('', { nonNullable: true, validators: motivoRechazoValidator });

  ngAfterViewInit(): void {
    // Abre el teclado directo en el campo, después de la animación del modal.
    setTimeout(() => this.campo?.nativeElement.focus(), 350);
  }

  /** El error se muestra recién cuando el mozo intentó confirmar o salió del campo. */
  get error(): string | null {
    return this.motivo.touched ? (this.motivo.errors?.['motivo'] ?? null) : null;
  }

  async enviar(): Promise<void> {
    if (this.procesando) return;
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      await this.avisos.error(this.motivo.errors?.['motivo']);
      return;
    }
    this.confirmar.emit(this.motivo.value);
  }
}
