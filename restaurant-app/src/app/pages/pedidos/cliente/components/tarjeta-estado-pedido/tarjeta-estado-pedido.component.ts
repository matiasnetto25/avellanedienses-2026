import { Component, computed, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  flameOutline,
  receiptOutline,
  timeOutline,
} from 'ionicons/icons';
import { EstadoPedido, Pedido } from '../../../../../core/models/pedido.model';
import { estadoPedido } from '../../../../../core/utils/estado-visual';
import { ChipEstadoComponent } from '../../../../../shared/components/chip-estado/chip-estado.component';

const TEXTOS: Partial<Record<EstadoPedido, { titulo: string; frase: string }>> = {
  pendiente_confirmacion: {
    titulo: 'El mozo está revisando tu pedido',
    frase: 'Cuando lo confirme, pasa a la cocina y a la barra.',
  },
  confirmado: {
    titulo: 'Tu pedido está en preparación',
    frase: 'Ya está en la cocina y la barra.',
  },
  rechazado: {
    titulo: 'El mozo rechazó tu pedido',
    frase: '',
  },
  pendiente_recepcion: {
    titulo: 'Tu pedido ya está en tu mesa',
    frase: 'Confirmá que lo recibiste.',
  },
  cuenta_pedida: {
    titulo: 'Pediste la cuenta',
    frase: 'El mozo ya fue avisado y te la acerca enseguida.',
  },
  pagado: {
    titulo: 'Tu pago fue confirmado',
    frase: 'Escaneá el QR de tu mesa para terminar tu visita.',
  },
  entregado: {
    titulo: '¡Tu pedido fue entregado!',
    frase: 'Esperamos que disfrutes tu pedido.',
  },
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
  /** Punto 19: el cliente toca «Confirmar recepción» (la pantalla abre el aviso). */
  readonly confirmarRecepcion = output<void>();
  /** Punto 21: el cliente toca «Ver cuenta» para dejar la propina y ver el detalle. */
  readonly verCuenta = output<void>();

  readonly estado = computed(() => {
    const pedido = this.pedido();
    return pedido ? estadoPedido(pedido.estado) : null;
  });

  readonly titulo = computed(() => {
    const pedido = this.pedido();
    if (!pedido) return 'Todavía no pediste';

    return (
      TEXTOS[pedido.estado]?.titulo ??
      'Estado de tu pedido'
    );
  });

  readonly frase = computed(() => {
    const pedido = this.pedido();

    if (!pedido) {
      return 'Elegí del menú y enviá tu pedido al mozo.';
    }

    if (pedido.estado === 'rechazado') {
      return `Motivo: ${pedido.motivoRechazo ?? ''}`;
    }

    if (pedido.estado === 'cuenta_pedida') {
      return pedido.propinaPorcentaje === null
        ? 'Falta la propina: escaneá el QR de propina para poder pagar.'
        : `Propina del ${pedido.propinaPorcentaje} %. Total a pagar: $ ${pedido.totalAPagar.toLocaleString('es-AR')}.`;
    }

    return (
      TEXTOS[pedido.estado]?.frase ??
      'Consultá el estado de tu pedido con el mozo.'
    );
  });

  constructor() {
    addIcons({
      receiptOutline,
      timeOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      flameOutline,
    });
  }
}