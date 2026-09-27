import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonButton } from '@ionic/angular/standalone';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { AvisosService } from '../../../core/services/avisos.service';
import { ClienteAnonimoService } from '../../../core/services/cliente-anonimo.service';
import { SolicitudesMesaService } from '../../../core/services/solicitudes-mesa.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { MesasService } from '../../../core/services/mesas.service';
import { MesaRow, etiquetaTipo } from '../../../core/models/mesa.model';
import { MiSolicitud } from '../../../core/models/solicitud-mesa.model';

@Component({
  selector: 'app-ver-mesas',
  standalone: true,
  imports: [AlturaDisponibleDirective, CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonButton],
  templateUrl: './ver-mesas.page.html',
  styleUrls: ['./ver-mesas.page.scss'],
})
export class VerMesasPage implements OnInit {
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly mesasService = inject(MesasService);

  readonly etiquetaTipo = etiquetaTipo;

  urlFoto(mesa: MesaRow): string | null {
    return this.mesasService.obtenerUrlFoto(mesa.foto);
  }

  urlFotoSolicitud(nombreArchivo: string | null): string | null {
    return this.mesasService.obtenerUrlFoto(nombreArchivo);
  }

  irAEscanearMesa(): void {
    this.router.navigate(['/cliente-anonimo/escaneo-mesa']);
  }

  irAMiMesa(mesaId: string): void {
    this.router.navigate(['/mesa', mesaId]);
  }

  private clienteId: string | null = null;
  readonly cargandoLista = signal(true);
  readonly mesas = signal<MesaRow[]>([]);
  readonly miSolicitud = signal<MiSolicitud | null>(null);
  readonly solicitando = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargandoLista.set(true);
    this.loading.mostrar();

    try {
      const cliente = await this.clienteAnonimo.obtenerClienteActual();
      if (!cliente) {
        await this.avisos.error('No se pudo identificar tu ingreso. Volvé a intentar desde el inicio.');
        return;
      }
      this.clienteId = cliente.id;

      const solicitud = await this.solicitudesMesa.obtenerMiSolicitud(cliente.id);
      this.miSolicitud.set(solicitud);

      if (!solicitud) {
        this.mesas.set(await this.solicitudesMesa.listarMesasParaSolicitar());
      }
    } finally {
      this.cargandoLista.set(false);
      this.loading.ocultar();
    }
  }

  async solicitar(mesa: MesaRow): Promise<void> {
    if (!this.clienteId || this.solicitando()) return;
    this.solicitando.set(mesa.id);
    this.loading.mostrar();

    try {
      const resultado = await this.solicitudesMesa.crearSolicitud(this.clienteId, mesa.id);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo solicitar la mesa.');
        // Puede que se nos haya adelantado alguien: refrescamos la lista.
        await this.cargar();
        return;
      }

      this.notificaciones.avisarClienteEnListaEspera(mesa.numero_mesa);

      // Actualiza la interfaz al toque, sin esperar a recargar del todo.
      this.miSolicitud.set({
        id: '',
        estado: 'en_espera',
        mesa_id: mesa.id,
        numero_mesa: mesa.numero_mesa,
        tipo: mesa.tipo,
        cant_comensales: mesa.cant_comensales,
        foto: mesa.foto,
      });
    } finally {
      this.solicitando.set(null);
      this.loading.ocultar();
    }
  }
}
