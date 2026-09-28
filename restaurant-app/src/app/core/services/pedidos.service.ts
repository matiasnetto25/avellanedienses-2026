import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { BUCKETS } from '../storage-buckets';
import {
  CANTIDAD_MAXIMA_ITEM,
  EstadoItem,
  EstadoPedido,
  ItemComanda,
  LineaCarrito,
  Pedido,
  PedidoItem,
  SectorItem,
  calcularTiempoEstimado,
  calcularTotal,
  validarMotivoRechazo,
} from '../models/pedido.model';
import { TipoMenuItem } from '../models/menu-item.model';
import { ResultadoOperacion } from '../models/resultado-operacion';
import { ResultadoBusqueda } from '../models/resultado-busqueda';

const TABLA_PEDIDOS = 'pedidos';
const TABLA_ITEMS = 'pedido_items';

/**
 * Joins por clave foránea (embedding de Supabase): pedido → estadía →
 * mesa, y pedido → ítems → producto de la carta. La estadía va con
 * !inner para poder filtrar por su cliente_id y su estado.
 */
const SELECT_PEDIDO = `
  id, created_at, solicitud_id, estado, motivo_rechazo,
  solicitud:solicitudes_mesa!inner (
    cliente_id, mesa_id, estado,
    mesa ( numero_mesa )
  ),
  items:pedido_items (
    menu_id, cantidad, precio_unitario, sector, estado,
    menu ( nombre, demora )
  )
`;

/**
 * Comandas de cocina y bar (punto 14): se lee desde los ítems hacia el
 * pedido. El pedido va con !inner para poder filtrar por su estado.
 */
const SELECT_COMANDA = `
  id, cantidad, estado,
  menu ( nombre, foto_principal ),
  pedido:pedidos!inner (
    id, created_at, estado,
    solicitud:solicitudes_mesa ( mesa ( numero_mesa ) )
  )
`;

/** Estados de pedido cuyos ítems ven cocina y bar. Los puntos 16 y 17 suman los suyos. */
const ESTADOS_EN_COMANDAS: EstadoPedido[] = ['confirmado'];

/** Códigos de Postgres que se traducen a mensajes para el cliente. */
const CODIGO_RLS = '42501';
const CODIGO_DUPLICADO = '23505';

/** La política de pedido_items rechazó un ítem: cambió el precio o se dio de baja el producto. */
const MENSAJE_PRODUCTOS_CAMBIARON =
  'Algunos productos cambiaron de precio o ya no están disponibles. Revisá tu pedido.';

/** El update del mozo no encontró el pedido pendiente: otro mozo se adelantó. Lo usan rechazar() y confirmar(). */
const MENSAJE_PEDIDO_YA_RESUELTO = 'Este pedido ya fue confirmado o rechazado por otro mozo.';

/** Espera antes de avisar un cambio: el pedido y sus ítems llegan como
 *  varios eventos seguidos (uno por fila), y así se relee una sola vez. */
const ESPERA_AGRUPAR_CAMBIOS_MS = 300;

export interface ResultadoCrearPedido extends ResultadoOperacion {
  pedidoId?: string;
  /** Para la push a los mozos (issue 05). */
  numeroMesa?: number;
  /** Si el cliente ya tenía un pedido: la pantalla lo lleva a su estado. */
  pedidoExistenteId?: string;
}

export interface ResultadoRechazo extends ResultadoOperacion {
  /** Para la push al cliente y su ruta (punto 13, issue 05). */
  clienteId?: string;
  mesaId?: string;
}

export interface ResultadoConfirmacion extends ResultadoOperacion {
  /** Para las push al cliente, a cocina y a bar (punto 14, issue 03). */
  clienteId?: string;
  mesaId?: string;
  numeroMesa?: number;
  /** Sectores con ítems en el pedido, sin repetir: a quiénes avisar. */
  sectores?: SectorItem[];
}

interface PedidoFila {
  id: string;
  created_at: string;
  solicitud_id: string;
  estado: EstadoPedido;
  motivo_rechazo: string | null;
  solicitud: {
    cliente_id: string;
    mesa_id: string;
    mesa: { numero_mesa: number };
  };
  items: {
    menu_id: string;
    cantidad: number;
    precio_unitario: number;
    sector: SectorItem;
    estado: EstadoItem;
    menu: { nombre: string; demora: number | null };
  }[];
}

interface ConfirmacionFila {
  solicitud: {
    cliente_id: string;
    mesa_id: string;
    mesa: { numero_mesa: number };
  };
  items: { sector: SectorItem }[];
}

interface ComandaFila {
  id: string;
  cantidad: number;
  estado: EstadoItem;
  menu: { nombre: string; foto_principal: string | null };
  pedido: {
    id: string;
    created_at: string;
    estado: EstadoPedido;
    solicitud: { mesa: { numero_mesa: number } };
  };
}

interface ProductoFila {
  id: string;
  precio: number;
  tipo: TipoMenuItem;
  estado: 'On' | 'Off';
}

/**
 * Único punto de la app que crea, lee y escucha los pedidos (punto 12).
 * Los puntos 13 (rechazo) y 14 (confirmación) le agregan métodos.
 *
 * Sin RPC: el pedido y sus ítems se crean con insert directo, y las
 * políticas RLS de la base validan la estadía, el precio y el sector
 * (ver la migración 20260927140000_pedidos.sql). El total y el tiempo
 * estimado no se guardan: se calculan acá a partir de los ítems.
 *
 * No envía push: las disparan las pantallas (ver NotificacionesService).
 */
@Injectable({ providedIn: 'root' })
export class PedidosService {
  private readonly supabase = inject(SupabaseService);

  // ===== Lectura =====

  /**
   * El pedido de la estadía vinculada del cliente. Distingue «todavía no
   * pidió» ({ ok: true, dato: null }) de «falló la consulta» ({ ok: false }):
   * la pantalla del estado muestra cada caso distinto.
   */
  async obtenerMiPedidoActivo(clienteId: string): Promise<ResultadoBusqueda<Pedido>> {
    const { data, error } = await this.supabase.client
      .from(TABLA_PEDIDOS)
      .select(SELECT_PEDIDO)
      .eq('solicitud.cliente_id', clienteId)
      .eq('solicitud.estado', 'vinculado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error obteniendo mi pedido:', error);
      return { ok: false };
    }
    return { ok: true, dato: data ? this.aPedido(data as unknown as PedidoFila) : null };
  }

  async obtener(pedidoId: string): Promise<Pedido | null> {
    const { data, error } = await this.supabase.client
      .from(TABLA_PEDIDOS)
      .select(SELECT_PEDIDO)
      .eq('id', pedidoId)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Error obteniendo pedido:', error);
      return null;
    }
    return this.aPedido(data as unknown as PedidoFila);
  }

  /**
   * Pedidos que esperan al mozo, del más viejo al más nuevo. null si
   * falló la consulta.
   *
   * Se ocultan los que todavía no tienen ítems: son pedidos que se están
   * creando en este momento (o que se van a borrar porque falló la carga).
   */
  async listarPendientesConfirmacion(): Promise<Pedido[] | null> {
    const { data, error } = await this.supabase.client
      .from(TABLA_PEDIDOS)
      .select(SELECT_PEDIDO)
      .eq('estado', 'pendiente_confirmacion')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error listando pedidos pendientes:', error);
      return null;
    }
    return (data as unknown as PedidoFila[])
      .map((fila) => this.aPedido(fila))
      .filter((pedido) => pedido.items.length > 0);
  }

  // ===== Creación =====

  /** Devuelve el mensaje de error de validación, o null si el carrito es válido. */
  validarLineas(lineas: LineaCarrito[]): string | null {
    if (lineas.length === 0) return 'Agregá al menos un producto antes de enviar el pedido.';

    const fueraDeRango = lineas.some(
      (linea) => !Number.isInteger(linea.cantidad) || linea.cantidad < 1 || linea.cantidad > CANTIDAD_MAXIMA_ITEM
    );
    if (fueraDeRango) return `La cantidad de cada producto tiene que ser de 1 a ${CANTIDAD_MAXIMA_ITEM}.`;

    const ids = new Set(lineas.map((linea) => linea.menuId));
    if (ids.size !== lineas.length) return 'Hay productos repetidos en el pedido.';

    return null;
  }

  /**
   * Crea el pedido de la estadía vinculada del cliente: primero el pedido
   * y después sus ítems, con el precio y el sector de la carta. Si los
   * ítems fallan, borra el pedido vacío para que el cliente pueda volver
   * a intentar (la base solo deja borrar un pedido pendiente y sin ítems).
   */
  async crear(clienteId: string, lineas: LineaCarrito[]): Promise<ResultadoCrearPedido> {
    const errorValidacion = this.validarLineas(lineas);
    if (errorValidacion) return { ok: false, mensaje: errorValidacion };

    try {
      const estadia = await this.obtenerEstadiaVinculada(clienteId);
      if (!estadia.ok) return { ok: false, mensaje: 'No se pudo verificar tu mesa. Revisá tu conexión.' };
      if (!estadia.dato) return { ok: false, mensaje: 'Necesitás tener una mesa asignada para hacer un pedido.' };

      const productos = await this.obtenerProductosDisponibles(lineas);
      if (!productos.ok) return productos;

      const { data: pedido, error: errorPedido } = await this.supabase.client
        .from(TABLA_PEDIDOS)
        .insert({ solicitud_id: estadia.dato.solicitudId })
        .select('id')
        .single();

      if (errorPedido) {
        console.error('Error creando pedido:', errorPedido);
        if (errorPedido.code === CODIGO_DUPLICADO) {
          const existente = await this.obtenerMiPedidoActivo(clienteId);
          const pedidoExistenteId = existente.ok ? existente.dato?.id : undefined;
          return { ok: false, mensaje: 'Ya tenés un pedido en curso.', pedidoExistenteId };
        }
        if (errorPedido.code === CODIGO_RLS) {
          return { ok: false, mensaje: 'Tu mesa ya no está habilitada para hacer pedidos.' };
        }
        return { ok: false, mensaje: 'No se pudo enviar el pedido. Probá de nuevo.' };
      }

      const { error: errorItems } = await this.supabase.client
        .from(TABLA_ITEMS)
        .insert(this.filasItems(pedido.id, lineas, productos.dato));

      if (errorItems) {
        console.error('Error cargando los productos del pedido:', errorItems);
        await this.borrarPedidoVacio(pedido.id);
        if (errorItems.code === CODIGO_RLS) return { ok: false, mensaje: MENSAJE_PRODUCTOS_CAMBIARON };
        return { ok: false, mensaje: 'No se pudo enviar el pedido. Probá de nuevo.' };
      }

      return { ok: true, pedidoId: pedido.id, numeroMesa: estadia.dato.numeroMesa };
    } catch (error: unknown) {
      console.error('Error inesperado creando pedido:', error);
      return { ok: false, mensaje: 'No se pudo enviar el pedido. Revisá tu conexión.' };
    }
  }

  // ===== Rechazo y reenvío (punto 13) =====

  /**
   * El mozo rechaza un pedido que espera confirmación, con un motivo
   * obligatorio. La base (RLS) solo lo acepta de un mozo activo y sobre un
   * pedido 'pendiente_confirmacion'.
   *
   * Si otro mozo ya lo rechazó o confirmó, el update no encuentra la fila
   * (no es un error de Postgres): vuelve sin filas y se avisa.
   */
  async rechazar(pedidoId: string, motivo: string): Promise<ResultadoRechazo> {
    const errorMotivo = validarMotivoRechazo(motivo);
    if (errorMotivo) return { ok: false, mensaje: errorMotivo };

    try {
      const { data, error } = await this.supabase.client
        .from(TABLA_PEDIDOS)
        .update({ estado: 'rechazado', motivo_rechazo: motivo.trim() })
        .eq('id', pedidoId)
        .eq('estado', 'pendiente_confirmacion')
        .select('solicitud:solicitudes_mesa ( cliente_id, mesa_id )');

      if (error) {
        console.error('Error rechazando pedido:', error);
        if (error.code === CODIGO_RLS) return { ok: false, mensaje: 'Solo un mozo puede rechazar pedidos.' };
        return { ok: false, mensaje: 'No se pudo rechazar el pedido. Probá de nuevo.' };
      }

      const fila = (data as unknown as { solicitud: { cliente_id: string; mesa_id: string } }[])[0];
      if (!fila) return { ok: false, mensaje: MENSAJE_PEDIDO_YA_RESUELTO };

      return { ok: true, clienteId: fila.solicitud.cliente_id, mesaId: fila.solicitud.mesa_id };
    } catch (error: unknown) {
      console.error('Error inesperado rechazando pedido:', error);
      return { ok: false, mensaje: 'No se pudo rechazar el pedido. Revisá tu conexión.' };
    }
  }

  /**
   * El cliente reenvía su pedido rechazado con los productos corregidos.
   * Es el MISMO pedido: se reemplazan sus ítems y vuelve a esperar al mozo.
   *
   * Tres pasos, siempre en este orden (sin transacción, ver la migración
   * 20260927150000_rechazo_reenvio_pedido.sql):
   *  1) borrar los ítems (la base solo lo deja si el pedido está rechazado),
   *  2) insertar los nuevos con el precio y el sector de la carta,
   *  3) liberar el pedido: 'pendiente_confirmacion' y sin motivo.
   * Hasta el paso 3 el pedido sigue rechazado y el mozo no lo ve, así que
   * si falla el 1 o el 2 no se sigue: el cliente conserva el carrito y
   * reintenta (borrar cero ítems no es un error).
   *
   * No recibe el cliente: pedidoId sale de obtenerMiPedidoActivo(), que ya
   * es el pedido de la estadía del cliente actual.
   */
  async reenviar(pedidoId: string, lineas: LineaCarrito[]): Promise<ResultadoOperacion> {
    const errorValidacion = this.validarLineas(lineas);
    if (errorValidacion) return { ok: false, mensaje: errorValidacion };

    try {
      const productos = await this.obtenerProductosDisponibles(lineas);
      if (!productos.ok) return productos;

      const { error: errorBorrado } = await this.supabase.client
        .from(TABLA_ITEMS)
        .delete()
        .eq('pedido_id', pedidoId);

      if (errorBorrado) {
        console.error('Error borrando los productos del pedido rechazado:', errorBorrado);
        return { ok: false, mensaje: 'No se pudo reenviar el pedido. Probá de nuevo.' };
      }

      const { error: errorItems } = await this.supabase.client
        .from(TABLA_ITEMS)
        .insert(this.filasItems(pedidoId, lineas, productos.dato));

      if (errorItems) {
        console.error('Error cargando los productos del pedido reenviado:', errorItems);
        if (errorItems.code === CODIGO_RLS) return { ok: false, mensaje: MENSAJE_PRODUCTOS_CAMBIARON };
        return { ok: false, mensaje: 'No se pudo reenviar el pedido. Probá de nuevo.' };
      }

      const { data, error: errorEstado } = await this.supabase.client
        .from(TABLA_PEDIDOS)
        .update({ estado: 'pendiente_confirmacion', motivo_rechazo: null })
        .eq('id', pedidoId)
        .eq('estado', 'rechazado')
        .select('id');

      if (errorEstado) {
        console.error('Error liberando el pedido reenviado:', errorEstado);
        if (errorEstado.code === CODIGO_RLS) {
          return { ok: false, mensaje: 'Tu mesa ya no está habilitada para hacer pedidos.' };
        }
        return { ok: false, mensaje: 'No se pudo reenviar el pedido. Probá de nuevo.' };
      }
      if (data.length === 0) return { ok: false, mensaje: 'Tu pedido ya no se puede modificar.' };

      return { ok: true };
    } catch (error: unknown) {
      console.error('Error inesperado reenviando pedido:', error);
      return { ok: false, mensaje: 'No se pudo reenviar el pedido. Revisá tu conexión.' };
    }
  }

  // ===== Confirmación (punto 14) =====

  /**
   * El mozo confirma un pedido que espera confirmación: desde ese momento
   * sus ítems aparecen en las comandas. La base (RLS) solo lo acepta de un
   * mozo activo, sobre un pedido 'pendiente_confirmacion' y con ítems.
   *
   * El mismo update devuelve lo que necesitan las push (cliente, mesa y
   * sectores), sin una segunda consulta. Si otro mozo ya lo confirmó o
   * rechazó, vuelve sin filas y se avisa, igual que en rechazar().
   */
  async confirmar(pedidoId: string): Promise<ResultadoConfirmacion> {
    try {
      const { data, error } = await this.supabase.client
        .from(TABLA_PEDIDOS)
        .update({ estado: 'confirmado' })
        .eq('id', pedidoId)
        .eq('estado', 'pendiente_confirmacion')
        .select('solicitud:solicitudes_mesa ( cliente_id, mesa_id, mesa ( numero_mesa ) ), items:pedido_items ( sector )');

      if (error) {
        console.error('Error confirmando pedido:', error);
        // Falló el with check: el pedido no tiene productos.
        if (error.code === CODIGO_RLS) return { ok: false, mensaje: 'No se puede confirmar un pedido sin productos.' };
        return { ok: false, mensaje: 'No se pudo confirmar el pedido. Probá de nuevo.' };
      }

      const fila = (data as unknown as ConfirmacionFila[])[0];
      if (!fila) return { ok: false, mensaje: MENSAJE_PEDIDO_YA_RESUELTO };

      return {
        ok: true,
        clienteId: fila.solicitud.cliente_id,
        mesaId: fila.solicitud.mesa_id,
        numeroMesa: fila.solicitud.mesa.numero_mesa,
        sectores: this.sectoresDe(fila.items),
      };
    } catch (error: unknown) {
      console.error('Error inesperado confirmando pedido:', error);
      return { ok: false, mensaje: 'No se pudo confirmar el pedido. Revisá tu conexión.' };
    }
  }

  // ===== Comandas (punto 14) =====

  /**
   * Ítems de un sector (cocina o bar) de los pedidos confirmados, del
   * pedido más viejo al más nuevo y con los ítems de cada pedido juntos.
   * null si falló la consulta.
   *
   * Se ordena acá y no en la consulta: ordenar pedido_items por una
   * columna del pedido embebido no es directo en supabase-js.
   */
  async listarComandas(sector: SectorItem): Promise<ItemComanda[] | null> {
    try {
      const { data, error } = await this.supabase.client
        .from(TABLA_ITEMS)
        .select(SELECT_COMANDA)
        .eq('sector', sector)
        .in('pedido.estado', ESTADOS_EN_COMANDAS);

      if (error) {
        console.error('Error listando comandas:', error);
        return null;
      }
      return (data as unknown as ComandaFila[])
        .map((fila) => this.aItemComanda(fila))
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.pedidoId.localeCompare(b.pedidoId));
    } catch (error: unknown) {
      console.error('Error inesperado listando comandas:', error);
      return null;
    }
  }

  private async obtenerEstadiaVinculada(
    clienteId: string
  ): Promise<ResultadoBusqueda<{ solicitudId: string; numeroMesa: number }>> {
    const { data, error } = await this.supabase.client
      .from('solicitudes_mesa')
      .select('id, mesa ( numero_mesa )')
      .eq('cliente_id', clienteId)
      .eq('estado', 'vinculado')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error buscando la estadía del cliente:', error);
      return { ok: false };
    }
    if (!data) return { ok: true, dato: null };

    const fila = data as unknown as { id: string; mesa: { numero_mesa: number } };
    return { ok: true, dato: { solicitudId: fila.id, numeroMesa: fila.mesa.numero_mesa } };
  }

  /**
   * Precio, tipo y estado actuales de cada producto de las líneas, por id.
   * Falla con un mensaje si no se pudo leer la carta o si alguno ya no
   * está activo (la base tampoco lo aceptaría).
   */
  private async obtenerProductosDisponibles(
    lineas: LineaCarrito[]
  ): Promise<{ ok: true; dato: Map<string, ProductoFila> } | { ok: false; mensaje: string }> {
    const { data, error } = await this.supabase.client
      .from('menu')
      .select('id, precio, tipo, estado')
      .in('id', lineas.map((linea) => linea.menuId));

    if (error) {
      console.error('Error leyendo los productos del pedido:', error);
      return { ok: false, mensaje: 'No se pudo leer la carta. Probá de nuevo.' };
    }

    const productos = new Map((data as ProductoFila[]).map((producto) => [producto.id, producto]));
    const disponibles = lineas.every((linea) => productos.get(linea.menuId)?.estado === 'On');
    if (!disponibles) {
      return { ok: false, mensaje: 'Alguno de los productos ya no está disponible. Revisá tu pedido.' };
    }
    return { ok: true, dato: productos };
  }

  /**
   * Filas de pedido_items con el precio y el sector de la carta: la base
   * (RLS) no acepta otros. Las usan crear() y reenviar().
   */
  private filasItems(pedidoId: string, lineas: LineaCarrito[], productos: Map<string, ProductoFila>) {
    return lineas.map((linea) => {
      const producto = productos.get(linea.menuId)!;
      return {
        pedido_id: pedidoId,
        menu_id: linea.menuId,
        cantidad: linea.cantidad,
        precio_unitario: producto.precio,
        sector: this.sectorDe(producto.tipo),
      };
    });
  }

  private async borrarPedidoVacio(pedidoId: string): Promise<void> {
    const { error } = await this.supabase.client.from(TABLA_PEDIDOS).delete().eq('id', pedidoId);
    if (error) console.error('No se pudo borrar el pedido vacío:', error);
  }

  /** Las bebidas van al bar; comidas y postres, a la cocina. La base exige lo mismo. */
  private sectorDe(tipo: TipoMenuItem): SectorItem {
    return tipo === 'bebida' ? 'bar' : 'cocina';
  }

  /** Sectores de los ítems, sin repetir: un pedido con comida y bebida da ['cocina', 'bar']. */
  private sectoresDe(items: { sector: SectorItem }[]): SectorItem[] {
    return [...new Set(items.map((item) => item.sector))];
  }

  // ===== Tiempo real =====

  /**
   * Avisa cada cambio de un pedido: su estado (el mozo lo confirma o lo
   * rechaza) o sus ítems (el cliente lo edita en el punto 13; cocina y bar
   * los preparan desde el 16). Entrega el pedido releído, o null si ya no
   * existe.
   *
   * Devuelve la función que cierra el canal; las pantallas la llaman en
   * ngOnDestroy.
   */
  suscribirseAMiPedido(pedidoId: string, alCambiar: (pedido: Pedido | null) => void): () => void {
    return this.escucharCambios(
      `mi-pedido-${pedidoId}`,
      { pedidos: `id=eq.${pedidoId}`, items: `pedido_id=eq.${pedidoId}` },
      async () => alCambiar(await this.obtener(pedidoId))
    );
  }

  /**
   * Avisa cada cambio del pedido de una estadía, aunque todavía no exista
   * cuando se empieza a escuchar (se filtra por solicitud_id, no por el id
   * del pedido). Solo mira la tabla pedidos: sirve para enterarse de los
   * cambios de estado, por ejemplo el rechazo del mozo (punto 13).
   */
  suscribirseAPedidoDeEstadia(solicitudId: string, alCambiar: (pedido: Pedido | null) => void): () => void {
    return this.escucharCambios(
      `pedido-estadia-${solicitudId}`,
      { pedidos: `solicitud_id=eq.${solicitudId}`, items: null },
      async (fila) => alCambiar(fila?.id ? await this.obtener(fila.id) : null)
    );
  }

  /**
   * Avisa cuando cambia cualquier pedido (uno nuevo, un cambio de estado o
   * de ítems). Es la lista del mozo: la pantalla vuelve a pedir la lista.
   */
  suscribirseAPedidos(alCambiar: () => void): () => void {
    return this.escucharCambios('pedidos-todos', {}, async () => alCambiar());
  }

  /**
   * Avisa cuando puede cambiar la comanda de un sector: un pedido cambia
   * de estado (el mozo lo confirma) o un ítem del sector cambia (cocina y
   * bar lo preparan, puntos 16 y 17). La pantalla vuelve a pedir la lista
   * con listarComandas().
   */
  suscribirseAComandas(sector: SectorItem, alCambiar: () => void): () => void {
    return this.escucharCambios(
      `comandas-${sector}`,
      { items: `sector=eq.${sector}` },
      async () => alCambiar()
    );
  }

  /**
   * filtros.items en null: no escucha los ítems. avisar recibe la última
   * fila de pedidos que cambió (null si el último cambio fue de un ítem).
   */
  private escucharCambios(
    nombre: string,
    filtros: { pedidos?: string; items?: string | null },
    avisar: (filaPedido: { id?: string } | null) => Promise<void>
  ): () => void {
    let espera: ReturnType<typeof setTimeout> | undefined;
    let ultimaFila: { id?: string } | null = null;
    const programarAviso = (fila: { id?: string } | null) => {
      ultimaFila = fila;
      clearTimeout(espera);
      espera = setTimeout(() => void avisar(ultimaFila), ESPERA_AGRUPAR_CAMBIOS_MS);
    };

    let canal: RealtimeChannel = this.supabase.client
      .channel(`${nombre}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLA_PEDIDOS,
          ...(filtros.pedidos ? { filter: filtros.pedidos } : {}),
        },
        (cambio) => programarAviso(cambio.new as { id?: string })
      );

    if (filtros.items !== null) {
      canal = canal.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLA_ITEMS,
          ...(filtros.items ? { filter: filtros.items } : {}),
        },
        () => programarAviso(null)
      );
    }

    canal.subscribe();

    return () => {
      clearTimeout(espera);
      this.supabase.client.removeChannel(canal);
    };
  }

  // ===== Mapeo de la respuesta anidada al modelo de la pantalla =====

  private aPedido(fila: PedidoFila): Pedido {
    const items: PedidoItem[] = fila.items.map((item) => ({
      menuId: item.menu_id,
      nombre: item.menu.nombre,
      cantidad: item.cantidad,
      precioUnitario: Number(item.precio_unitario),
      sector: item.sector,
      estado: item.estado,
      demoraMin: item.menu.demora ?? 0,
      subtotal: Number(item.precio_unitario) * item.cantidad,
    }));

    return {
      id: fila.id,
      solicitudId: fila.solicitud_id,
      clienteId: fila.solicitud.cliente_id,
      mesaId: fila.solicitud.mesa_id,
      numeroMesa: fila.solicitud.mesa.numero_mesa,
      creadoEn: fila.created_at,
      estado: fila.estado,
      motivoRechazo: fila.motivo_rechazo,
      total: calcularTotal(items),
      tiempoEstimadoMin: calcularTiempoEstimado(items.map((item) => item.demoraMin)),
      items,
    };
  }

  private aItemComanda(fila: ComandaFila): ItemComanda {
    return {
      id: fila.id,
      pedidoId: fila.pedido.id,
      numeroMesa: fila.pedido.solicitud.mesa.numero_mesa,
      fecha: fila.pedido.created_at,
      nombre: fila.menu.nombre,
      foto: this.supabase.urlPublica(BUCKETS.menu, fila.menu.foto_principal),
      cantidad: fila.cantidad,
      estado: fila.estado,
    };
  }
}
