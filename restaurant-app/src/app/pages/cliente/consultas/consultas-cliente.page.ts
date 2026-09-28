import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';

// La pestaña abre el chat a pantalla completa; al volver del chat, lleva a Mi mesa.
@Component({
  selector: 'app-consultas-cliente',
  standalone: true,
  imports: [IonContent],
  template: '<ion-content class="densidad-amplia" />',
})
export class ConsultasClientePage {
  private readonly router = inject(Router);
  private readonly etapaCliente = inject(EtapaClienteService);

  private abrioElChat = false;

  async ionViewWillEnter(): Promise<void> {
    await this.etapaCliente.iniciar();
    const etapa = this.etapaCliente.etapa();

    if (this.abrioElChat || etapa?.tipo !== 'estadia') {
      this.abrioElChat = false;
      this.router.navigate(['/cliente/inicio'], { replaceUrl: true });
      return;
    }

    this.abrioElChat = true;
    this.router.navigate(['/consultas', etapa.solicitud.id], { replaceUrl: true });
  }
}
