import { Component, Input, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IonButton } from '@ionic/angular/standalone';
import { ROL_MODIFICAR_PEDIDO } from './aviso-rechazo.service';


/**
 * Cartel que le avisa al cliente que el mozo rechazó su pedido (punto 13):
 * el motivo y una sola acción, «Modificar pedido». Lo abre siempre
 * AvisoRechazoService, que decide adónde ir según el rol con que se cierra.
 * Tocar afuera o el botón atrás lo cierran sin modificar.
 */
@Component({
  selector: 'app-aviso-rechazo',
  standalone: true,
  imports: [IonButton],
  templateUrl: './aviso-rechazo.component.html',
  styleUrls: ['./aviso-rechazo.component.scss'],
})
export class AvisoRechazoComponent {
  private readonly modalController = inject(ModalController);

  @Input({ required: true }) numeroMesa!: number;
  @Input({ required: true }) motivo!: string;

  modificar(): void {
    void this.modalController.dismiss(null, ROL_MODIFICAR_PEDIDO);
  }
}
