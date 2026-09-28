import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonBadge,
  IonButton,
} from '@ionic/angular/standalone';
import { Auth } from '../../core/services/auth';
import { MesasService } from '../../core/services/mesas.service';
import { LoadingService } from '../../core/services/loading.service';
import { AvisosService } from '../../core/services/avisos.service';
import { ClienteActualService } from '../../core/services/cliente-actual.service';
import { SolicitudesMesaService } from '../../core/services/solicitudes-mesa.service';
import { PedidosService } from '../../core/services/pedidos.service';
import { AvisoRechazoService } from '../pedidos/cliente/components/aviso-rechazo/aviso-rechazo.service';
import { MesaRow, etiquetaTipo } from '../../core/models/mesa.model';
import { PUESTOS_VISTA_MESA } from '../../core/models/empleado.model';
import { EstadoPedido, pedidoConfirmado } from '../../core/models/pedido.model';

/**
 * Qué se muestra en la pantalla, según quién la abre:
 *  - staff:       metre/mozo/dueño/supervisor → información de la mesa.
 *  - cliente:     cliente vinculado a ESTA mesa → sus opciones de la estadía.
 *  - otraMesa:    cliente vinculado a OTRA mesa → se le indica cuál es la suya.
 *  - sinMesa:     cliente sin mesa vinculada → no puede usar esta mesa.
 *  - sinPermiso:  empleado cuyo puesto no ve información de mesas.
 */
type VistaMesa = 'staff' | 'cliente' | 'otraMesa' | 'sinMesa' | 'sinPermiso';

@Component({
  selector: 'app-mesa',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonBadge,
    IonButton,
  ],
  templateUrl: './mesa.page.html',
  styleUrls: ['./mesa.page.scss'],
})
export class MesaPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly mesasService = inject(MesasService);
  private readonly loading = inject(LoadingService);
  protected readonly avisos = inject(AvisosService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly pedidos = inject(PedidosService);
  private readonly avisoRechazo = inject(AvisoRechazoService);

  readonly etiquetaTipo = etiquetaTipo;

  readonly cargando = signal(true);
  readonly mesa = signal<MesaRow | null>(null);
  readonly noEncontrada = signal(false);
  readonly vista = signal<VistaMesa | null>(null);

  /** Mesa a la que realmente está vinculado el cliente (solo en la vista 'otraMesa'). */
  readonly miMesa = signal<{ id: string; numero: number } | null>(null);

  /** Estadía del cliente en esta mesa (solo en la vista 'cliente'): abre su chat con el mozo. */
  readonly solicitudId = signal<string | null>(null);

  /**
   * Estado del pedido de la estadía, o null si todavía no pidió. Si la
   * consulta falla queda en null: la base igual no deja crear un segundo
   * pedido. Sin Realtime: se relee al volver a la pantalla.
   */
  readonly estadoPedido = signal<EstadoPedido | null>(null);

  /**
   * Hay un solo pedido por estadía: sin pedido se ofrece «Hacer pedido»; con
   * pedido, ese mismo botón pasa a ser «Estado de mi pedido».
   */
  readonly tienePedido = computed(() => this.estadoPedido() !== null);

  /** Cliente de la estadía (solo en la vista 'cliente'): para volver a consultar su pedido. */
  private clienteId: string | null = null;

  /** A dónde vuelve el botón atrás: panel del empleado o pantalla principal del cliente. */
  readonly rutaVolver = signal('/bienvenida');

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const idMesa = this.route.snapshot.paramMap.get('idMesa');
      const mesa = idMesa ? await this.mesasService.obtenerPorId(idMesa) : null;

      if (!mesa) {
        this.noEncontrada.set(true);
        return;
      }
      this.mesa.set(mesa);

      await this.resolverVista(mesa);
    } catch (error) {
      console.error('Error cargando la mesa:', error);
      await this.avisos.error('No se pudo cargar la mesa. Probá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  private async resolverVista(mesa: MesaRow): Promise<void> {
    // Si la app arrancó directo en esta ruta (por ejemplo, al tocar una
    // push), app.component puede no haber terminado de restaurar la
    // sesión todavía: sin esto, un mozo se vería como "cliente sin mesa".
    if (!this.auth.sesion()) {
      await this.auth.restaurarSesion();
    }
    const sesion = this.auth.sesion();

    if (sesion) {
      this.rutaVolver.set('/inicio');
      const puedeVer = sesion.estado === 'On' && (PUESTOS_VISTA_MESA as string[]).includes(sesion.puesto);
      this.vista.set(puedeVer ? 'staff' : 'sinPermiso');
      return;
    }

    this.rutaVolver.set(await this.clienteActual.rutaInicioCliente());

    const clienteId = await this.clienteActual.obtenerClienteIdActual();
    const solicitud = clienteId ? await this.solicitudesMesa.obtenerMiSolicitud(clienteId) : null;

    if (solicitud?.estado !== 'vinculado') {
      this.vista.set('sinMesa');
      return;
    }

    if (solicitud.mesa_id !== mesa.id) {
      this.miMesa.set({ id: solicitud.mesa_id, numero: solicitud.numero_mesa });
      this.vista.set('otraMesa');
      return;
    }

    this.clienteId = clienteId;
    this.solicitudId.set(solicitud.id);
    // Recién vinculado (o la app arrancó antes de que tuviera mesa): desde
    // acá se escucha el rechazo del pedido en cualquier pantalla.
    void this.avisoRechazo.vigilar();
    await this.actualizarEstadoPedido();
    this.vista.set('cliente');
  }

  /**
   * Ionic deja esta pantalla guardada en la pila al ir a la carta o al
   * estado: al volver no se ejecuta ngOnInit. Sin esto, después de enviar
   * un pedido el botón seguiría diciendo «Hacer pedido», y «Juegos» no se
   * enteraría de que el mozo lo confirmó.
   */
  async ionViewWillEnter(): Promise<void> {
    if (this.vista() === 'cliente') await this.actualizarEstadoPedido();
  }

  private async actualizarEstadoPedido(): Promise<void> {
    if (!this.clienteId) return;
    const resultado = await this.pedidos.obtenerMiPedidoActivo(this.clienteId);
    this.estadoPedido.set(resultado.ok ? (resultado.dato?.estado ?? null) : null);
  }

  /**
   * «Juegos» (punto 15, sin asignar) queda siempre tocable: se habilita
   * cuando el mozo confirma el pedido (punto 14).
   */
  abrirJuegos(): void {
    const estado = this.estadoPedido();
    if (estado && pedidoConfirmado(estado)) {
      void this.avisos.proximamente();
    } else {
      void this.avisos.info('Disponible cuando el mozo confirme tu pedido.');
    }
  }

  urlFoto(mesa: MesaRow): string | null {
    return this.mesasService.obtenerUrlFoto(mesa.foto);
  }

  irAMiMesa(): void {
    const miMesa = this.miMesa();
    if (miMesa) {
      this.router.navigate(['/mesa', miMesa.id], { replaceUrl: true });
    }
  }

  volverAlInicio(): void {
    this.router.navigate([this.rutaVolver()], { replaceUrl: true });
  }
}
