import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cardOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  flameOutline,
  peopleOutline,
  syncOutline,
  timeOutline,
} from 'ionicons/icons';
import { EstadoVisual } from '../../../core/utils/estado-visual';

/**
 * Chip de estado (guía §7.5): píldora con el color del tono, ícono y texto.
 * Nunca es solo color.
 *
 *   <app-chip-estado [estado]="estadoPedido(p.estado)" />
 *
 * y en la página: `readonly estadoPedido = estadoPedido;`
 */
@Component({
  selector: 'app-chip-estado',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './chip-estado.component.html',
  styleUrls: ['./chip-estado.component.scss'],
})
export class ChipEstadoComponent {
  readonly estado = input.required<EstadoVisual>();

  constructor() {
    // Los íconos de la tabla de estado-visual.ts.
    addIcons({
      timeOutline,
      flameOutline,
      syncOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      peopleOutline,
      cardOutline,
    });
  }
}
