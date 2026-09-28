import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { PanelInicioComponent, AccionPanel } from '../../shared/components/panel-inicio/panel-inicio.component';
import { ClienteAnonimoService } from '../../core/services/cliente-anonimo.service';
import { SolicitudesMesaService } from '../../core/services/solicitudes-mesa.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { LoadingService } from '../../core/services/loading.service';
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
  private readonly alertController = inject(AlertController);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
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
  /** true cuando intentó cerrar sesión con la mesa ya vinculada — no se
   *  lo dejamos hacer, y le mostramos este cartel en su lugar. */
  readonly avisoMostrador = signal(false);
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
   * Cerrar sesión de un cliente anónimo equivale a borrar su cuenta por
   * completo (no tiene contraseña ni nada que "recordar" más allá del
   * id guardado en el dispositivo) — por eso se le avisa antes.
   *
   * Si ya está VINCULADO a una mesa (llegó y escaneó su QR), no se lo
   * deja cerrar sesión bajo ninguna circunstancia: tiene que resolverlo
   * en persona en el mostrador.
   */
  async cerrarSesion(): Promise<void> {
    if (!this.clienteId) return;

    const solicitud = await this.solicitudesMesa.obtenerMiSolicitud(this.clienteId);

    if (solicitud?.estado === 'vinculado') {
      this.avisoMostrador.set(true);
      this.notificaciones.avisarCierreSesionBloqueado(solicitud.numero_mesa);
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: 'Se van a borrar tus datos y vas a tener que volver a ingresar.',
      cssClass: 'merlot-alert',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          handler: () => this.confirmarCierreSesion(),
        },
      ],
    });
    await alert.present();
  }

  private async confirmarCierreSesion(): Promise<void> {
    if (!this.clienteId) return;
    const nombreCliente = this.nombre();
    this.loading.mostrar();

    try {
      const resultado = await this.clienteAnonimo.eliminarCuenta(this.clienteId);

      if (!resultado.ok) {
        if (resultado.bloqueado) {
          // Se coló una vinculación justo en el medio — mismo caso que
          // el chequeo de arriba, tratado igual.
          this.avisoMostrador.set(true);
        } else {
          await this.avisos.error(resultado.mensaje ?? 'No se pudo cerrar sesión. Probá de nuevo en un momento.');
        }
        return;
      }

      this.notificaciones.avisarClienteCerroSesion(nombreCliente, resultado.mesaLiberada);

      this.router.navigate(['/bienvenida'], { replaceUrl: true });
    } finally {
      this.loading.ocultar();
    }
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
