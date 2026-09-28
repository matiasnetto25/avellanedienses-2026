import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, closeCircleOutline, receiptOutline, timeOutline } from 'ionicons/icons';
import { EstadoPedido, Pedido } from '../../../../../core/models/pedido.model';
import { estadoPedido } from '../../../../../core/utils/estado-visual';
import { ChipEstadoComponent } from '../../../../../shared/components/chip-estado/chip-estado.component';

const TEXTOS: Record<EstadoPedido, { titulo: string; frase: string }> = {
  pendiente_confirmacion: {
    titulo: 'El mozo está revisando tu pedido',
    frase: 'Cuando lo confirme, pasa a la cocina y a la barra.',
  },
  confirmado: { titulo: 'Tu pedido está confirmado', frase: 'Ya pasó a la cocina y a la barra.' },
  rechazado: { titulo: 'El mozo rechazó tu pedido', frase: '' },
};

@Component({
  selector: 'app-tarjeta-estado-pedido',
  standalone: true,
  imports: [IonButton, IonIcon, ChipEstadoComponent],
  templateUrl: './tarjeta-estado-pedido.component.html',
  styleUrls: ['./tarjeta-estado-pedido.component.scss'],
})
export class TarjetaEstadoPedidoComponent {
  readonly pedido = input<Pedido | null>(null);
  readonly revisar = output<void>();

  readonly estado = computed(() => {
    const pedido = this.pedido();
    return pedido ? estadoPedido(pedido.estado) : null;
  });

  readonly titulo = computed(() => {
    const pedido = this.pedido();
    return pedido ? TEXTOS[pedido.estado].titulo : 'Todavía no pediste';
  });

  readonly frase = computed(() => {
    const pedido = this.pedido();
    if (!pedido) return 'Elegí del menú y enviá tu pedido al mozo.';
    if (pedido.estado === 'rechazado') return `Motivo: ${pedido.motivoRechazo ?? ''}`;
    return TEXTOS[pedido.estado].frase;
  });

  constructor() {
    addIcons({ receiptOutline, timeOutline, checkmarkCircleOutline, closeCircleOutline });
  }
}
