import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonRouterLink, ToastController } from '@ionic/angular';
import { MarcaHeaderComponent } from '../../../shared/components/marca-header/marca-header.component';
import { NOMBRE_GRUPO } from '../../../core/identidad-app';

@Component({
  selector: 'app-bienvenida',
  standalone: true,
  imports: [IonContent, IonButton, IonRouterLink, RouterLink, MarcaHeaderComponent],
  templateUrl: './bienvenida.page.html',
  styleUrls: ['./bienvenida.page.scss'],
})
export class BienvenidaPage {
  private readonly toastController = inject(ToastController);

  readonly nombreGrupo = NOMBRE_GRUPO;

  async registrarse(): Promise<void> {
    // Sin spec de registro implementada todavía; se deja el botón visible pero inerte.
    const toast = await this.toastController.create({
      message: 'Registro: próximamente disponible.',
      duration: 2000,
      position: 'bottom',
    });
    await toast.present();
  }
}
