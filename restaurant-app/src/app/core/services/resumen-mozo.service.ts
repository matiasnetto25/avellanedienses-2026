import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { AvisosService } from './avisos.service';
import { ConsultasService } from './consultas.service';
import { PedidosService } from './pedidos.service';
import { Pedido } from '../models/pedido.model';
import { ConversacionActiva, MensajeMesa, esDeCliente } from '../models/consulta.model';

/**
 * Pedidos por confirmar y conversaciones del mozo, en vivo. Lo comparten
 * «Ahora», la barra de pestañas, Pedidos y Consultas: una sola suscripción
 * de Realtime por tabla, que se cierra al cerrar sesión.
 */
@Injectable({ providedIn: 'root' })
export class ResumenMozoService {
  private readonly pedidosService = inject(PedidosService);
  private readonly consultas = inject(ConsultasService);
  private readonly avisos = inject(AvisosService);

  private readonly _pedidos = signal<Pedido[]>([]);
  private readonly _conversaciones = signal<ConversacionActiva[]>([]);

  readonly pedidos = this._pedidos.asReadonly();
  readonly conversaciones = this._conversaciones.asReadonly();
  readonly errorPedidos = signal(false);
  readonly errorConversaciones = signal(false);

  readonly porConfirmar = computed(() => this._pedidos().length);
  readonly sinResponder = computed(() => this._conversaciones().filter((c) => c.sin_responder));
  readonly consultasSinResponder = computed(() => this.sinResponder().length);

  private iniciando: Promise<void> | null = null;
  private desuscripciones: (() => void)[] = [];
  private readonly oyentesMensajes = new Set<(mensaje: MensajeMesa) => void>();

  constructor() {
    inject(Auth).alCerrarSesion(async () => this.detener());
  }

  /** Idempotente: la primera llamada carga y se suscribe; las demás esperan esa misma carga. */
  iniciar(): Promise<void> {
    this.iniciando ??= this.arrancar();
    return this.iniciando;
  }

  private async arrancar(): Promise<void> {
    await Promise.all([this.recargarPedidos(), this.recargarConversaciones()]);
    this.desuscripciones = [
      this.pedidosService.suscribirseAPedidos(() => void this.recargarPedidos()),
      this.consultas.suscribirse(null, (mensaje) => void this.alNuevoMensaje(mensaje)),
    ];
  }

  detener(): void {
    this.desuscripciones.forEach((cerrar) => cerrar());
    this.desuscripciones = [];
    this.iniciando = null;
    this._pedidos.set([]);
    this._conversaciones.set([]);
    this.errorPedidos.set(false);
    this.errorConversaciones.set(false);
  }

  async recargarPedidos(): Promise<void> {
    const pedidos = await this.pedidosService.listarPendientesConfirmacion();
    if (pedidos === null) {
      if (this._pedidos().length === 0) this.errorPedidos.set(true);
      await this.avisos.error('No se pudieron cargar los pedidos. Probá de nuevo.');
      return;
    }
    this.errorPedidos.set(false);
    this._pedidos.set(pedidos);
  }

  async recargarConversaciones(): Promise<void> {
    const conversaciones = await this.consultas.listarConversaciones();
    if (conversaciones === null) {
      if (this._conversaciones().length === 0) this.errorConversaciones.set(true);
      await this.avisos.error('No se pudieron cargar las conversaciones. Probá de nuevo.');
      return;
    }
    this.errorConversaciones.set(false);
    this._conversaciones.set(conversaciones);
  }

  /** Se saca ya, sin esperar a que Realtime relea la lista. */
  quitarPedido(pedidoId: string): void {
    this._pedidos.update((lista) => lista.filter((p) => p.id !== pedidoId));
  }

  /** Devuelve la función que deja de escuchar. */
  alRecibirMensaje(oyente: (mensaje: MensajeMesa) => void): () => void {
    this.oyentesMensajes.add(oyente);
    return () => this.oyentesMensajes.delete(oyente);
  }

  private async alNuevoMensaje(mensaje: MensajeMesa): Promise<void> {
    this.oyentesMensajes.forEach((oyente) => oyente(mensaje));

    const actual = this._conversaciones().find((c) => c.solicitud_id === mensaje.solicitud_id);
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
      ...lista.filter((c) => c.solicitud_id !== mensaje.solicitud_id),
    ]);
  }
}
