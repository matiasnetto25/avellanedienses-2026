import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { qrCodeOutline } from 'ionicons/icons';
import { AvisosService } from '../../../core/services/avisos.service';
import { QrService } from '../../../core/services/qr.service';
import { ClienteAnonimoService } from '../../../core/services/cliente-anonimo.service';
import { SolicitudesMesaService } from '../../../core/services/solicitudes-mesa.service';
import { LoadingService } from '../../../core/services/loading.service';

@Component({
  selector: 'app-escaneo-mesa',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonButton, IonIcon],
  templateUrl: './escaneo-mesa.page.html',
  styleUrls: ['./escaneo-mesa.page.scss'],
})
export class EscaneoMesaPage implements OnInit {
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly qr = inject(QrService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly loading = inject(LoadingService);

  private clienteId: string | null = null;
  escaneando = false;

  constructor() {
    addIcons({ qrCodeOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const cliente = await this.clienteAnonimo.obtenerClienteActual();
      if (!cliente) {
        await this.avisos.error('No se pudo identificar tu ingreso. Volvé a intentar desde el inicio.');
        this.router.navigate(['/principal'], { replaceUrl: true });
        return;
      }
      this.clienteId = cliente.id;

      // Si ya está vinculado, no tiene sentido mostrarle el escaneo de
      // nuevo: lo mandamos directo a la pantalla de su mesa.
      const solicitud = await this.solicitudesMesa.obtenerMiSolicitud(cliente.id);
      if (solicitud?.estado === 'vinculado') {
        this.router.navigate(['/mesa', solicitud.mesa_id], { replaceUrl: true });
      }
    } finally {
      this.loading.ocultar();
    }
  }

  async escanear(): Promise<void> {
    if (this.escaneando || !this.clienteId) return;
    this.escaneando = true;

    try {
      const resultado = await this.qr.escanearQrMesa();

      if (!resultado.ok) {
        if (!resultado.cancelado) {
          await this.avisos.error(resultado.mensaje ?? 'No se pudo escanear el código.');
        }
        return;
      }

      this.loading.mostrar();
      const vinculacion = await this.solicitudesMesa.vincularMesa(this.clienteId, resultado.mesaId!);
      this.loading.ocultar();

      if (!vinculacion.ok) {
        await this.avisos.error(vinculacion.mensaje ?? 'No se pudo vincular con la mesa.');
        return;
      }

      this.router.navigate(['/mesa', resultado.mesaId], { replaceUrl: true });
    } finally {
      this.escaneando = false;
    }
  }
}