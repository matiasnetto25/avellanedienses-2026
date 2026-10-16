import { AfterViewInit, Component, ElementRef, Input, ViewChild, inject } from '@angular/core';
import { AbstractControl, FormControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { ModalController } from '@ionic/angular';
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
 * motivo y los botones. Se abre con ModalController (así no depende de la
 * fila que lo abrió, que Realtime puede sacar de la lista mientras el modal
 * está abierto). Valida el motivo y cierra con rol 'confirm' y el texto como
 * data; el rechazo lo hace quien lo abrió. La ventana (.motivo-modal) se
 * define en theme/componentes.scss.
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
  private readonly modalController = inject(ModalController);

  @Input({ required: true }) numeroMesa!: number;

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

  cancelar(): void {
    void this.modalController.dismiss(null, 'cancel');
  }

  async enviar(): Promise<void> {
    if (this.motivo.invalid) {
      this.motivo.markAsTouched();
      await this.avisos.error(this.motivo.errors?.['motivo']);
      return;
    }
    await this.modalController.dismiss(this.motivo.value, 'confirm');
  }
}
