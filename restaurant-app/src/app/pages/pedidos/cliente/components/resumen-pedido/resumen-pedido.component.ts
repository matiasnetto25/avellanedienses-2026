import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { ItemCarrito } from '../../../../../core/models/pedido.model';


@Component({
  selector: 'app-resumen-pedido',
  standalone: true,
  imports: [CommonModule, IonButton],
  templateUrl: './resumen-pedido.component.html',
  styleUrls: ['./resumen-pedido.component.scss'],
})
export class ResumenPedidoComponent {
  @Input({ required: true }) items!: ItemCarrito[];
  @Input() total = 0;
  @Input() tiempoEstimado = 0;
  /** Solo informativo, para el título; null si no se conoce. */
  @Input() numeroMesa: number | null = null;
  /** true mientras se envía: deshabilita los dos botones. */
  @Input() enviando = false;

  @Output() seguirEligiendo = new EventEmitter<void>();
  @Output() enviar = new EventEmitter<void>();
}
