import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { Auth } from '../../core/services/auth';
import { SesionService } from '../../core/services/sesion.service';

@Component({
  selector: 'app-metre',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './metre.page.html',
  styleUrls: ['./metre.page.scss'],
})
export class MetrePage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  protected readonly sesionService = inject(SesionService);

  readonly sesion = this.auth.sesion;

  get nombreCompleto(): string {
    const s = this.sesion();
    return s ? `${s.nombre} ${s.apellido}` : '';
  }

  get fotoEmpleado(): string | null {
    return this.sesion()?.foto ?? null;
  }

  registrarCliente(): void {
    this.router.navigate(['/registrar-cliente']);
  }

  async asignarMesa(): Promise<void> {
    await this.proximamente();
  }

  listaDeEspera(): void {
    this.router.navigate(['/metre/lista-espera']);
  }

  private async proximamente(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Esta sección se habilita en la próxima entrega.',
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }
}
