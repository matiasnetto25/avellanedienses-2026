import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { Auth } from '../../core/services/auth';
import { ClientesService } from '../../core/services/clientes.service';

@Component({
  selector: 'app-landing-cliente',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './landing-cliente.page.html',
  styleUrls: ['./landing-cliente.page.scss'],
})
export class LandingClientePage implements OnInit {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly clientesService = inject(ClientesService);

  readonly nombreCompleto = signal('');
  readonly fotoUrl = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const cliente = await this.clientesService.obtenerClienteActual();
    if (!cliente) return;

    this.nombreCompleto.set(`${cliente.nombre} ${cliente.apellido ?? ''}`.trim());
    this.fotoUrl.set(this.clientesService.obtenerUrlFoto(cliente.foto));
  }

  async menu(): Promise<void> {
    await this.proximamente();
  }

  async misPedidos(): Promise<void> {
    await this.proximamente();
  }

  async encuestas(): Promise<void> {
    await this.proximamente();
  }

  async cerrarSesion(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
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