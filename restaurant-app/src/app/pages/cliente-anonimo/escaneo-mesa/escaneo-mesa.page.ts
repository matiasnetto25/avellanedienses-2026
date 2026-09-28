import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { qrCodeOutline } from 'ionicons/icons';
import { AvisosService } from '../../../core/services/avisos.service';
import { QrService } from '../../../core/services/qr.service';
import { ClienteActualService } from '../../../core/services/cliente-actual.service';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';
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
  private readonly clienteActual = inject(ClienteActualService);
  private readonly etapaCliente = inject(EtapaClienteService);
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
      const clienteId = await this.clienteActual.obtenerClienteIdActual();
      if (!clienteId) {
        await this.avisos.error('No se pudo identificar tu ingreso. Volvé a intentar desde el inicio.');
        this.router.navigate(['/principal'], { replaceUrl: true });
        return;
      }
      this.clienteId = clienteId;

      // Si ya está vinculado, no tiene sentido mostrarle el escaneo de
      // nuevo: lo mandamos directo a la pantalla de su mesa.
      const solicitud = await this.solicitudesMesa.obtenerMiSolicitud(clienteId);
      if (solicitud?.estado === 'vinculado') {
        this.router.navigate(['/cliente/inicio'], { replaceUrl: true });
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

      await this.etapaCliente.refrescar();
      this.router.navigate(['/cliente/inicio'], { replaceUrl: true });
    } finally {
      this.escaneando = false;
    }
  }
}