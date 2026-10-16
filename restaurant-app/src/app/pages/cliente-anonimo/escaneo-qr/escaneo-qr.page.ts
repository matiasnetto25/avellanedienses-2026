import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { qrCodeOutline } from 'ionicons/icons';
import { AvisosService } from '../../../core/services/avisos.service';
import { ClienteActualService } from '../../../core/services/cliente-actual.service';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';
import { LoadingService } from '../../../core/services/loading.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { PerfilActualService } from '../../../core/services/perfil-actual.service';
import { QrService } from '../../../core/services/qr.service';
import { SolicitudesMesaService } from '../../../core/services/solicitudes-mesa.service';

/**
 * Ingreso al local: el cliente escanea el QR de la entrada y queda en la
 * lista de espera, sin mesa. El maître le asigna una mesa libre y recién
 * entonces el cliente escanea el QR de esa mesa.
 */
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
  private readonly clienteActual = inject(ClienteActualService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly etapaCliente = inject(EtapaClienteService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly loading = inject(LoadingService);

  escaneando = false;

  constructor() {
    addIcons({ qrCodeOutline });
  }

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

      await this.anotarseEnLaLista();
    } finally {
      this.escaneando = false;
    }
  }

  private async anotarseEnLaLista(): Promise<void> {
    const clienteId = await this.clienteActual.obtenerClienteIdActual();
    if (!clienteId) {
      await this.avisos.error('No se pudo identificar tu ingreso. Volvé a intentar desde el inicio.');
      this.router.navigate(['/principal'], { replaceUrl: true });
      return;
    }

    this.loading.mostrar();
    try {
      const solicitud = await this.solicitudesMesa.solicitarIngreso(clienteId);

      if (!solicitud.ok) {
        // Típico: ya estaba anotado. El inicio le muestra en qué etapa está.
        await this.avisos.info(solicitud.mensaje ?? 'No se pudo anotarte en la lista de espera.');
      } else {
        const perfil = await this.perfilActual.obtener();
        this.notificaciones.avisarClienteEnListaEspera(perfil?.nombre ?? 'Un cliente');
        await this.avisos.exito('Listo, estás en la lista de espera.');
      }

      await this.etapaCliente.refrescar();
      this.router.navigate(['/cliente/inicio'], { replaceUrl: true });
    } finally {
      this.loading.ocultar();
    }
  }
}