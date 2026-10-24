import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { ClienteActualService } from './cliente-actual.service';
import { PedidosService } from './pedidos.service';
import { SolicitudesMesaService } from './solicitudes-mesa.service';
import { MiSolicitud, SolicitudConMesa, tieneMesa } from '../models/solicitud-mesa.model';
import { Pedido, pedidoConfirmado, pedidoEntregado } from '../models/pedido.model';

// 'cuenta-pedida' (punto 21) todavía no se emite:
// | { tipo: 'cuenta-pedida'; solicitud: MiSolicitud; pedido: Pedido }
export type EtapaCliente =
  | { tipo: 'sin-mesa' }
  | { tipo: 'en-espera'; solicitud: MiSolicitud }
  | { tipo: 'mesa-asignada'; solicitud: SolicitudConMesa }
  | { tipo: 'estadia'; solicitud: SolicitudConMesa; pedido: Pedido | null };

/**
 * En qué etapa está el cliente del dispositivo (lineamientos §3), en vivo.
 * La comparten las pestañas y el inicio del cliente: una sola suscripción,
 * que se corta al cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class EtapaClienteService {
  private readonly clienteActual = inject(ClienteActualService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly pedidos = inject(PedidosService);

  private readonly _etapa = signal<EtapaCliente | null>(null);
  /** null mientras carga la primera vez. */
  readonly etapa = this._etapa.asReadonly();
  readonly solicitudRechazada = signal(false);
  readonly posicionEnLista = signal<number | null>(null);
  readonly enEstadia = computed(() => this._etapa()?.tipo === 'estadia');
  /** Los juegos se habilitan cuando el mozo confirma el pedido (punto 14). */
  readonly juegosHabilitados = computed(() => {
    const etapa = this._etapa();
    return etapa?.tipo === 'estadia' && !!etapa.pedido && pedidoConfirmado(etapa.pedido.estado);
  });
  /**
   * La encuesta de satisfacción (punto 20) está oculta hasta que el cliente
   * recibe el pedido (punto 19): estado 'entregado' o posterior. La misma
   * regla la aplica la política encuestas_insert_cliente.
   */
  readonly encuestaHabilitada = computed(() => {
    const etapa = this._etapa();
    return etapa?.tipo === 'estadia' && !!etapa.pedido && pedidoEntregado(etapa.pedido.estado);
  });

  /** Lo marca el inicio. Ya no se usa para avisar: los cambios de etapa los avisa la push nativa. */
  mirandoInicio = false;

  private clienteId: string | null = null;
  private iniciando: Promise<void> | null = null;
  private dejarDeObservarSolicitud: (() => void) | null = null;
  private pedidoObservado: { solicitudId: string; dejarDeEscuchar: () => void } | null = null;

  constructor() {
    inject(Auth).alCerrarSesion(async () => this.detener());
  }

  iniciar(): Promise<void> {
    this.iniciando ??= this.arrancar();
    return this.iniciando;
  }

  detener(): void {
    this.dejarDeObservarSolicitud?.();
    this.dejarDeObservarSolicitud = null;
    this.dejarDeObservarPedido();
    this.iniciando = null;
    this.clienteId = null;
    this._etapa.set(null);
    this.solicitudRechazada.set(false);
    this.posicionEnLista.set(null);
  }

  /** Para las pantallas que cambian la solicitud (pedir mesa, escanear la mesa) sin esperar a Realtime. */
  async refrescar(): Promise<void> {
    await this.iniciar();
    if (this.clienteId) await this.aplicar(await this.solicitudesMesa.obtenerMiSolicitud(this.clienteId));
  }

  private async arrancar(): Promise<void> {
    const clienteId = await this.clienteActual.obtenerClienteIdActual();
    this.clienteId = clienteId;
    if (!clienteId) {
      this._etapa.set({ tipo: 'sin-mesa' });
      return;
    }

    await this.aplicar(await this.solicitudesMesa.obtenerMiSolicitud(clienteId));
    this.dejarDeObservarSolicitud = this.solicitudesMesa.observarMiSolicitud(clienteId, (solicitud) =>
      void this.aplicar(solicitud)
    );
  }

  private async aplicar(solicitud: MiSolicitud | null): Promise<void> {
    this.solicitudRechazada.set(solicitud?.estado === 'rechazado');

    switch (solicitud?.estado) {
      case 'en_espera':
        this.dejarDeObservarPedido();
        this.posicionEnLista.set(await this.solicitudesMesa.obtenerPosicionEnLista(solicitud.id));
        this._etapa.set({ tipo: 'en-espera', solicitud });
        break;
      case 'aceptado':
        this.dejarDeObservarPedido();
        // Aceptada siempre trae mesa (lo garantiza la base); sin ella no hay nada que escanear.
        this._etapa.set(tieneMesa(solicitud) ? { tipo: 'mesa-asignada', solicitud } : { tipo: 'sin-mesa' });
        break;
      case 'vinculado':
        if (tieneMesa(solicitud)) {
          await this.entrarEnEstadia(solicitud);
        } else {
          this.dejarDeObservarPedido();
          this._etapa.set({ tipo: 'sin-mesa' });
        }
        break;
      default:
        this.dejarDeObservarPedido();
        this._etapa.set({ tipo: 'sin-mesa' });
    }

  }

  private async entrarEnEstadia(solicitud: SolicitudConMesa): Promise<void> {
    if (this.pedidoObservado?.solicitudId !== solicitud.id) {
      this.dejarDeObservarPedido();
      this.pedidoObservado = {
        solicitudId: solicitud.id,
        dejarDeEscuchar: this.pedidos.suscribirseAPedidoDeEstadia(solicitud.id, (pedido) => {
          const etapa = this._etapa();
          if (etapa?.tipo === 'estadia') this._etapa.set({ ...etapa, pedido });
        }),
      };
    }

    const resultado = this.clienteId ? await this.pedidos.obtenerMiPedidoActivo(this.clienteId) : null;
    const pedido = resultado?.ok ? (resultado.dato ?? null) : null;
    this._etapa.set({ tipo: 'estadia', solicitud, pedido });
  }

  private dejarDeObservarPedido(): void {
    this.pedidoObservado?.dejarDeEscuchar();
    this.pedidoObservado = null;
  }
}