import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { qrCodeOutline } from 'ionicons/icons';
import { AvisosService } from '../../../core/services/avisos.service';
import { QrService } from '../../../core/services/qr.service';

@Component({
  selector: 'app-escaneo-qr',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonButton, IonIcon],
  templateUrl: './escaneo-qr.page.html',
  styleUrls: ['./escaneo-qr.page.scss'],
})
export class EscaneoQrPage {
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly qrService = inject(QrService);

  escaneando = false;

  async escanear(): Promise<void> {
    if (this.escaneando) return;
    this.escaneando = true;

    try {
      const resultado = await this.qrService.escanearQrIngreso();

      if (!resultado.ok) {
        if (!resultado.cancelado) {
          await this.avisos.error(resultado.mensaje ?? 'No se pudo escanear el código.');
        }
        return;
      }

      this.router.navigate(['/cliente-anonimo/ver-mesas']);
    } finally {
      this.escaneando = false;
    }
  }

  constructor() {
    addIcons({ qrCodeOutline });
  }
}
