import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { AlertController, ToastController } from '@ionic/angular';
import { RealtimeChannel } from '@supabase/supabase-js';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { ClienteAnonimoService } from '../../core/services/cliente-anonimo.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { LoadingService } from '../../core/services/loading.service';
import { EstadoSolicitudMesa } from '../../core/models/solicitud-mesa.model';

/** Red de seguridad, por si el canal en tiempo real se corta (por
 *  ejemplo, se pierde la conexión un momento) — mucho más espaciado
 *  que antes, porque ahora el cambio normalmente llega al toque. */
const INTERVALO_RESPALDO_MS = 30000;

@Component({
  selector: 'app-landing-cliente-anonimo',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './landing-cliente-anonimo.page.html',
  styleUrls: ['./landing-cliente-anonimo.page.scss'],
})
export class LandingClienteAnonimoPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);
  private readonly alertController = inject(AlertController);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly supabase = inject(SupabaseService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  readonly nombre = signal('');
  readonly fotoUrl = signal<string | null>(null);
  private clienteId: string | null = null;
  private intervaloId: ReturnType<typeof setInterval> | null = null;
  private canal: RealtimeChannel | null = null;

  /** Texto del cartel inferior, o null si no hay que mostrar nada
   *  (sin solicitud, rechazada, o ya vinculado a la mesa). */
  readonly cartelAviso = signal<string | null>(null);
  /** 'en_espera' | 'aceptado' — para poder colorear el cartel distinto
   *  según corresponda (verde cuando ya está disponible). */
  readonly estadoCartel = signal<EstadoSolicitudMesa | null>(null);
  /** true cuando intentó cerrar sesión con la mesa ya vinculada — no se
   *  lo dejamos hacer, y le mostramos este cartel en su lugar. */
  readonly avisoMostrador = signal(false);

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
    this.suscribirseACambios(cliente.id);

    // Red de seguridad: si por algún motivo el canal en tiempo real no
    // llega a conectarse (o se corta), esto igual termina reflejando
    // el cambio, aunque tarde un poco más.
    this.intervaloId = setInterval(() => {
      this.actualizarCartel();
    }, INTERVALO_RESPALDO_MS);
  }

  ngOnDestroy(): void {
    if (this.intervaloId !== null) {
      clearInterval(this.intervaloId);
      this.intervaloId = null;
    }
    if (this.canal) {
      this.supabase.client.removeChannel(this.canal);
      this.canal = null;
    }
  }

  /**
   * Se suscribe a los cambios de la fila de ESTE cliente en
   * solicitudes_mesa — apenas el metre acepta (o rechaza) su solicitud,
   * Supabase empuja el cambio al instante, sin esperar ningún intervalo.
   */
  private suscribirseACambios(clienteId: string): void {
    this.canal = this.supabase.client
      .channel(`mi-solicitud-${clienteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'solicitudes_mesa',
          filter: `cliente_id=eq.${clienteId}`,
        },
        () => {
          this.actualizarCartel();
        }
      )
      .subscribe();
  }

  /** Se vuelve a llamar cada vez que se vuelve a esta pantalla (por
   *  ejemplo, después de escanear el QR de la mesa), para que el
   *  cartel desaparezca apenas corresponda. */
  async ionViewWillEnter(): Promise<void> {
    await this.actualizarCartel();
  }

  private async actualizarCartel(): Promise<void> {
    if (!this.clienteId) return;
    const solicitud = await this.clienteAnonimo.obtenerMiSolicitud(this.clienteId);
    const estado = solicitud?.estado ?? null;
    this.cartelAviso.set(this.textoCartel(estado));
    this.estadoCartel.set(estado === 'en_espera' || estado === 'aceptado' ? estado : null);
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

    const solicitud = await this.clienteAnonimo.obtenerMiSolicitud(this.clienteId);

    if (solicitud?.estado === 'vinculado') {
      this.avisoMostrador.set(true);
      this.notificaciones.notificarCreacion(
        'Cliente pidió cerrar sesión',
        `El cliente de la Mesa ${solicitud.numero_mesa} intentó cerrar sesión estando ya vinculado. Se le indicó acercarse al mostrador.`,
        { puestos: ['metre'], ruta: '/metre' }
      );
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: 'Esta acción provocará que se borren sus datos. Deberá volver a iniciar sesión nuevamente.',
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
          const alert = await this.alertController.create({
            header: 'No se pudo cerrar sesión',
            message: resultado.mensaje ?? 'Probá de nuevo en un momento.',
            cssClass: 'merlot-alert',
            buttons: ['Aceptar'],
          });
          await alert.present();
        }
        return;
      }

      this.notificaciones.notificarCreacion(
        'Cliente cerró sesión',
        resultado.mesaLiberada
          ? `${nombreCliente} cerró sesión. La Mesa ${resultado.mesaLiberada} quedó libre.`
          : `${nombreCliente} cerró sesión.`,
        { puestos: ['metre'] }
      );

      this.router.navigate(['/bienvenida'], { replaceUrl: true });
    } finally {
      this.loading.ocultar();
    }
  }

  /**
   * Si ya hay una solicitud activa, no tiene sentido pedirle que vuelva
   * a escanear el QR de la entrada — va directo a ver-mesas.page, que
   * ya muestra su mesa (foto + info) en vez de la lista para elegir.
   */
  async listaDeEspera(): Promise<void> {
    if (!this.clienteId) return;
    const solicitud = await this.clienteAnonimo.obtenerMiSolicitud(this.clienteId);

    if (solicitud) {
      this.router.navigate(['/cliente-anonimo/ver-mesas']);
    } else {
      this.router.navigate(['/cliente-anonimo/escaneo-qr']);
    }
  }

  async menu(): Promise<void> {
    this.router.navigate(['/menu']);
  }

  async miPedido(): Promise<void> {
    await this.proximamente();
  }

  async encuestas(): Promise<void> {
    await this.proximamente();
  }

  private async proximamente(): Promise<void> {
    const toast = await this.toastController.create({
      message: 'Próximo deploy.',
      duration: 1800,
      position: 'bottom',
    });
    await toast.present();
  }
}
