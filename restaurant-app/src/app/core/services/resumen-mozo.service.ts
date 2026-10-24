
import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { AvisosService } from './avisos.service';
import { ConsultasService } from './consultas.service';
import { NotificacionesService } from './notificaciones.service';
import { PedidosService } from './pedidos.service';
import { Pedido } from '../models/pedido.model';
import {
  ConversacionActiva,
  MensajeMesa,
  esDeCliente,
} from '../models/consulta.model';

/**
 * Pedidos por confirmar, pedidos listos para entregar y conversaciones
 * del mozo, en vivo.
 */
@Injectable({ providedIn: 'root' })
export class ResumenMozoService {
  private readonly pedidosService = inject(PedidosService);
  private readonly consultas = inject(ConsultasService);
  private readonly avisos = inject(AvisosService);
  private readonly notificaciones = inject(NotificacionesService);

  private readonly _pedidos = signal<Pedido[]>([]);
  private readonly _conversaciones = signal<ConversacionActiva[]>([]);
  private readonly _pedidosListos = signal<Pedido[]>([]);
  private readonly _pedidosEsperandoRecepcion = signal<Pedido[]>([]);

  readonly pedidos = this._pedidos.asReadonly();
  readonly conversaciones = this._conversaciones.asReadonly();
  readonly pedidosListos = this._pedidosListos.asReadonly();
  /** Entregados por el mozo, a la espera de que el cliente confirme (punto 19). */
  readonly pedidosEsperandoRecepcion =
    this._pedidosEsperandoRecepcion.asReadonly();

  readonly cantidadListosParaEntregar = computed(
    () => this._pedidosListos().length
  );

  readonly errorPedidos = signal(false);
  readonly errorConversaciones = signal(false);

  readonly porConfirmar = computed(() => this._pedidos().length);

  readonly sinResponder = computed(() =>
    this._conversaciones().filter((c) => c.sin_responder)
  );

  readonly consultasSinResponder = computed(
    () => this.sinResponder().length
  );

  private iniciando: Promise<void> | null = null;
  private desuscripciones: (() => void)[] = [];
  private readonly oyentesMensajes = new Set<
    (mensaje: MensajeMesa) => void
  >();

  constructor() {
    inject(Auth).alCerrarSesion(async () => this.detener());
  }

  /** Inicia la carga y las suscripciones una sola vez. */
  iniciar(): Promise<void> {
    this.iniciando ??= this.arrancar();
    return this.iniciando;
  }

  private async arrancar(): Promise<void> {
    await Promise.all([
      this.recargarPedidos(),
      this.recargarPedidosListos(),
      this.recargarPedidosEsperandoRecepcion(),
      this.recargarConversaciones(),
    ]);

    this.desuscripciones = [
      this.pedidosService.suscribirseAPedidos(() => {
        void this.recargarPedidosActualizados();
      }),
      this.consultas.suscribirse(
        null,
        (mensaje) => void this.alNuevoMensaje(mensaje)
      ),
    ];
  }

  private async recargarPedidosActualizados(): Promise<void> {
    await Promise.all([
      this.recargarPedidos(),
      this.recargarPedidosListos(),
      this.recargarPedidosEsperandoRecepcion(),
    ]);
  }

  async recargarPedidosListos(): Promise<void> {
    const pedidos =
      await this.pedidosService.listarPedidosListosParaEntregar();

    if (pedidos === null) {
      console.error(
        'No se pudieron actualizar los pedidos listos para entregar.'
      );
      return;
    }

    this._pedidosListos.set(pedidos);
  }

  /**
   * Registra la entrega en Supabase y quita el pedido de la lista
   * solamente cuando la operación tuvo éxito.
   */
  async entregarPedido(pedidoId: string): Promise<boolean> {
    const resultado = await this.pedidosService.entregar(pedidoId);

    if (!resultado.ok) {
      await this.avisos.error(
        resultado.mensaje ?? 'No se pudo entregar el pedido.'
      );
      await this.recargarPedidosActualizados();
      return false;
    }

    // Actualización inmediata de la interfaz.
    this._pedidosListos.update((lista) =>
      lista.filter((pedido) => pedido.id !== pedidoId)
    );
    void this.recargarPedidosEsperandoRecepcion();

    // Push al cliente: llega con la app abierta, en segundo plano o cerrada.
    if (resultado.clienteId && resultado.mesaId) {
      this.notificaciones.avisarPedidoEntregado(
        resultado.clienteId,
        resultado.mesaId
      );
    }

    return true;
  }

  async recargarPedidosEsperandoRecepcion(): Promise<void> {
    const pedidos =
      await this.pedidosService.listarPedidosEsperandoRecepcion();

    if (pedidos === null) {
      console.error(
        'No se pudieron actualizar los pedidos esperando recepción.'
      );
      return;
    }

    this._pedidosEsperandoRecepcion.set(pedidos);
  }

  detener(): void {
    this.desuscripciones.forEach((cerrar) => cerrar());
    this.desuscripciones = [];
    this.iniciando = null;

    this._pedidos.set([]);
    this._conversaciones.set([]);
    this._pedidosListos.set([]);
    this._pedidosEsperandoRecepcion.set([]);

    this.errorPedidos.set(false);
    this.errorConversaciones.set(false);
  }

  async recargarPedidos(): Promise<void> {
    const pedidos =
      await this.pedidosService.listarPendientesConfirmacion();

    if (pedidos === null) {
      if (this._pedidos().length === 0) {
        this.errorPedidos.set(true);
      }

      await this.avisos.error(
        'No se pudieron cargar los pedidos. Probá de nuevo.'
      );
      return;
    }

    this.errorPedidos.set(false);
    this._pedidos.set(pedidos);
  }

  async recargarConversaciones(): Promise<void> {
    const conversaciones =
      await this.consultas.listarConversaciones();

    if (conversaciones === null) {
      if (this._conversaciones().length === 0) {
        this.errorConversaciones.set(true);
      }
      return;
    }

    this.errorConversaciones.set(false);
    this._conversaciones.set(conversaciones);
  }

  /** Quita un pedido de la lista de pedidos por confirmar. */
  quitarPedido(pedidoId: string): void {
    this._pedidos.update((lista) =>
      lista.filter((pedido) => pedido.id !== pedidoId)
    );
  }

  /** Registra un oyente de mensajes y devuelve cómo desuscribirlo. */
  alRecibirMensaje(
    oyente: (mensaje: MensajeMesa) => void
  ): () => void {
    this.oyentesMensajes.add(oyente);
    return () => this.oyentesMensajes.delete(oyente);
  }

  private async alNuevoMensaje(
    mensaje: MensajeMesa
  ): Promise<void> {
    this.oyentesMensajes.forEach((oyente) => oyente(mensaje));

    const actual = this._conversaciones().find(
      (conversacion) =>
        conversacion.solicitud_id === mensaje.solicitud_id
    );

    if (!actual) {
      await this.recargarConversaciones();
      return;
    }

    const actualizada: ConversacionActiva = {
      ...actual,
      ultimo_texto: mensaje.texto,
      ultimo_created_at: mensaje.created_at,
      sin_responder: esDeCliente(mensaje),
    };

    this._conversaciones.update((lista) => [
      actualizada,
      ...lista.filter(
        (conversacion) =>
          conversacion.solicitud_id !== mensaje.solicitud_id
      ),
    ]);
  }
}
