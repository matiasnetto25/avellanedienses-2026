import { Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  chatbubblesOutline,
  checkmarkDoneOutline,
  flameOutline,
  peopleOutline,
  personAddOutline,
  receiptOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-estado-vacio',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './estado-vacio.component.html',
  styleUrls: ['./estado-vacio.component.scss'],
  host: { '[class.recuadro]': 'recuadro()' },
})
export class EstadoVacioComponent {
  /** Nombre de Ionicons, por ejemplo "receipt-outline". */
  readonly icono = input.required<string>();
  readonly titulo = input.required<string>();
  readonly frase = input<string>();
  /** Muestra el contenido dentro de un recuadro suave que llena el alto libre. */
  readonly recuadro = input<boolean>(false);

  constructor() {
    // Los íconos de la tabla de estados vacíos (lineamientos §8).
    addIcons({
      checkmarkDoneOutline,
      receiptOutline,
      chatbubblesOutline,
      flameOutline,
      peopleOutline,
      personAddOutline,
      chatbubbleEllipsesOutline,
    });
  }
}