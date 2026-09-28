import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { AvatarPerfilComponent } from '../avatar-perfil/avatar-perfil.component';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { SesionService } from '../../../core/services/sesion.service';

/**
 * Hoja de perfil (guía §7.9): hoja inferior con la foto, el nombre, el puesto
 * (o "Cliente · Mesa 4") y «Cerrar sesión». No se abre a mano: la abre
 * app-avatar-perfil al tocarlo. Se cierra arrastrándola hacia abajo o
 * tocando afuera.
 *
 * Nombre y foto llegan del avatar para mostrarlos al instante; el detalle
 * y el tipo de usuario (que decide cómo se cierra la sesión) se cargan acá.
 */
@Component({
  selector: 'app-hoja-perfil',
  standalone: true,
  imports: [IonButton, IonIcon, AvatarPerfilComponent],
  templateUrl: './hoja-perfil.component.html',
  styleUrls: ['./hoja-perfil.component.scss'],
})
export class HojaPerfilComponent implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly sesion = inject(SesionService);

  @Input({ required: true }) nombre!: string;
  @Input() foto: string | null = null;

  readonly perfil = signal<PerfilActual | null>(null);

  constructor() {
    addIcons({ logOutOutline });
  }

  async ngOnInit(): Promise<void> {
    this.perfil.set(await this.perfilActual.obtener());
  }

  async cerrarSesion(): Promise<void> {
    // Primero se cierra la hoja: si no, quedaría abierta sobre /bienvenida.
    await this.modalController.dismiss();

    const perfil = this.perfil();
    if (perfil) {
      await this.sesion.salir(perfil);
    } else {
      await this.sesion.cerrarSesion();
    }
  }
}
