import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PanelInicioComponent, AccionPanel } from '../../shared/components/panel-inicio/panel-inicio.component';
import { ClienteAnonimoService } from '../../core/services/cliente-anonimo.service';
import { SolicitudesMesaService } from '../../core/services/solicitudes-mesa.service';
import { AvisosService } from '../../core/services/avisos.service';
import { EstadoSolicitudMesa, MiSolicitud } from '../../core/models/solicitud-mesa.model';

@Component({
  selector: 'app-landing-cliente-anonimo',
  standalone: true,
  imports: [PanelInicioComponent],
  templateUrl: './landing-cliente-anonimo.page.html',
  styleUrls: ['./landing-cliente-anonimo.page.scss'],
})
export class LandingClienteAnonimoPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly avisos = inject(AvisosService);

  readonly nombre = signal('');
  readonly fotoUrl = signal<string | null>(null);
  private clienteId: string | null = null;
  private dejarDeObservar: (() => void) | null = null;

  /** Texto del cartel inferior, o null si no hay que mostrar nada
   *  (sin solicitud, rechazada, o ya vinculado a la mesa). */
  readonly cartelAviso = signal<string | null>(null);
  /** 'en_espera' | 'aceptado' — para poder colorear el cartel distinto
   *  según corresponda (verde cuando ya está disponible). */
  readonly estadoCartel = signal<EstadoSolicitudMesa | null>(null);
  /** Id de la mesa a la que está vinculado (escaneó su QR), o null. Cuando
   *  hay valor, el botón "Lista de espera" pasa a ser "Mi mesa". */
  readonly mesaVinculadaId = signal<string | null>(null);

  readonly acciones = computed<AccionPanel[]>(() => [
    { texto: this.mesaVinculadaId() ? 'Mi mesa' : 'Lista de espera', accion: () => this.listaDeEspera() },
    { texto: 'Menú', ruta: '/menu' },
    { texto: 'Mi pedido', accion: () => this.avisos.proximamente() },
    { texto: 'Ver encuestas', accion: () => this.avisos.proximamente() },
  ]);

  async ngOnInit(): Promise<void> {
    const cliente = await this.clienteAnonimo.obtenerClienteActual();
    if (!cliente) {
      // No debería pasar (se llega acá solo después de registrarse), pero
      // por las dudas lo mandamos de vuelta al alta si no hay nada guardado.
      this.router.navigate(['/principal'], { replaceUrl: true });
      return;
    }
    this.clienteId = cliente.id;
    this.nombre.set(cliente.nombre);
    this.fotoUrl.set(cliente.fotoUrl);

    await this.actualizarCartel();

    // Apenas el metre acepta o rechaza, el cartel se actualiza solo
    // (Realtime, con un sondeo de respaldo; ver SolicitudesMesaService).
    this.dejarDeObservar = this.solicitudesMesa.observarMiSolicitud(cliente.id, (solicitud) =>
      this.mostrarCartel(solicitud)
    );
  }

  ngOnDestroy(): void {
    this.dejarDeObservar?.();
    this.dejarDeObservar = null;
  }

  /** Se vuelve a llamar cada vez que se vuelve a esta pantalla (por
   *  ejemplo, después de escanear el QR de la mesa), para que el
   *  cartel desaparezca apenas corresponda. */
  async ionViewWillEnter(): Promise<void> {
    await this.actualizarCartel();
  }

  private async actualizarCartel(): Promise<void> {
    if (!this.clienteId) return;
    this.mostrarCartel(await this.solicitudesMesa.obtenerMiSolicitud(this.clienteId));
  }

  private mostrarCartel(solicitud: MiSolicitud | null): void {
    const estado = solicitud?.estado ?? null;
    this.cartelAviso.set(this.textoCartel(estado));
    this.estadoCartel.set(estado === 'en_espera' || estado === 'aceptado' ? estado : null);
    this.mesaVinculadaId.set(estado === 'vinculado' ? solicitud!.mesa_id : null);
  }

  private textoCartel(estado: EstadoSolicitudMesa | null): string | null {
    if (estado === 'en_espera') return 'Se encuentra en la lista de espera.';
    if (estado === 'aceptado') return 'Su mesa se encuentra disponible. Escanee el QR aquí.';
    return null; // vinculado, rechazado, o sin solicitud: sin cartel
  }

  irAEscanearMesa(): void {
    this.router.navigate(['/cliente-anonimo/escaneo-mesa']);
  }

  /**
   * - Vinculado a una mesa (ya escaneó su QR): va directo a la pantalla
   *   de su mesa — en ese caso el botón se muestra como "Mi mesa".
   * - Con una solicitud activa: no tiene sentido pedirle que vuelva a
   *   escanear el QR de la entrada — va a ver-mesas.page, que ya muestra
   *   su mesa (foto + info) en vez de la lista para elegir.
   */
  async listaDeEspera(): Promise<void> {
    if (!this.clienteId) return;
    const solicitud = await this.solicitudesMesa.obtenerMiSolicitud(this.clienteId);

    if (solicitud?.estado === 'vinculado') {
      this.router.navigate(['/mesa', solicitud.mesa_id]);
    } else if (solicitud) {
      this.router.navigate(['/cliente-anonimo/ver-mesas']);
    } else {
      this.router.navigate(['/cliente-anonimo/escaneo-qr']);
    }
  }
}
