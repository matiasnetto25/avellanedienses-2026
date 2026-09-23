import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { Auth } from '../../core/services/auth';
import { NotificacionesService } from '../../core/services/notificaciones.service';

@Component({
  selector: 'app-mozo',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './mozo.page.html',
  styleUrls: ['./mozo.page.scss'],
})
export class MozoPage {
  private readonly auth = inject(Auth);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  readonly sesion = this.auth.sesion;

  get nombreCompleto(): string {
    const s = this.sesion();
    return s ? `${s.nombre} ${s.apellido}` : '';
  }

  get fotoEmpleado(): string | null {
    return this.sesion()?.foto ?? null;
  }

  async proximamente(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Próximo deploy.',
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }

  async cerrarSesion(): Promise<void> {
    await this.notificaciones.eliminarTokenAlCerrarSesion();
    await this.auth.logout();
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }
}
