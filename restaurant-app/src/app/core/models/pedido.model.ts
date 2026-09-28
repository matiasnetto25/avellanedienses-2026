import { Producto } from './producto.model';

/**
 * Pedido de una estadía (tablas "pedidos" y "pedido_items"), ya aplanado
 * para la pantalla: la mesa y el cliente salen del join con la estadía, y
 * el nombre y la demora de cada producto, del join con la carta.
 */

/** Los puntos 16 en adelante suman estados (en preparación, listo, etc.). */
export type EstadoPedido = 'pendiente_confirmacion' | 'rechazado' | 'confirmado';
export type EstadoItem = 'pendiente' | 'en_preparacion' | 'listo';
export type SectorItem = 'cocina' | 'bar';

/** Tope por producto: evita errores de tipeo (por ejemplo, 200 gaseosas).
 *  La base tiene el mismo límite (pedido_items_cantidad_check). */
export const CANTIDAD_MAXIMA_ITEM = 20;

/** Largo del motivo con que el mozo rechaza un pedido (punto 13), sin
 *  contar los espacios de los bordes. La base tiene el mismo límite
 *  (pedidos_motivo_rechazo_largo). */
export const MOTIVO_RECHAZO_MIN = 5;
export const MOTIVO_RECHAZO_MAX = 200;

/** Devuelve el mensaje de error del motivo, o null si es válido. */
export function validarMotivoRechazo(motivo: string): string | null {
  const largo = motivo.trim().length;
  if (largo === 0) return 'Escribí el motivo del rechazo.';
  if (largo < MOTIVO_RECHAZO_MIN) return `El motivo tiene que tener al menos ${MOTIVO_RECHAZO_MIN} caracteres.`;
  if (largo > MOTIVO_RECHAZO_MAX) return `El motivo puede tener hasta ${MOTIVO_RECHAZO_MAX} caracteres.`;
  return null;
}

/** Lo que arma el cliente en la carta: un producto y cuántos quiere. */
export interface LineaCarrito {
  menuId: string;
  cantidad: number;
}

/** Un producto del carrito con la cantidad elegida. */
export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

export interface PedidoItem {
  menuId: string;
  nombre: string;
  cantidad: number;
  /** Precio de la carta al momento de pedir: no cambia si después se edita la carta. */
  precioUnitario: number;
  sector: SectorItem;
  estado: EstadoItem;
  /** Demora del producto en minutos (de la carta). */
  demoraMin: number;
  subtotal: number;
}

export interface Pedido {
  id: string;
  /** La estadía: fila de solicitudes_mesa en estado 'vinculado'. */
  solicitudId: string;
  clienteId: string;
  mesaId: string;
  numeroMesa: number;
  /** Fecha ISO. Se formatea en la vista con DatePipe. */
  creadoEn: string;
  estado: EstadoPedido;
  motivoRechazo: string | null;
  /** Calculados a partir de los ítems: la base no los guarda. */
  total: number;
  tiempoEstimadoMin: number;
  items: PedidoItem[];
}

/**
 * Parcial a propósito: un estado nuevo (punto 16 en adelante) compila
 * aunque todavía no tenga texto, y se muestra tal cual hasta agregarlo.
 */
const ETIQUETAS_ESTADO_PEDIDO: Partial<Record<EstadoPedido, string>> = {
  pendiente_confirmacion: 'Esperando confirmación del mozo',
  rechazado: 'Rechazado por el mozo',
  confirmado: 'Confirmado',
};

export function etiquetaEstadoPedido(estado: EstadoPedido): string {
  return ETIQUETAS_ESTADO_PEDIDO[estado] ?? estado;
}

/** Suma de precio por cantidad. La usan PedidosService y CarritoService (barra de la carta, issue 04). */
export function calcularTotal(lineas: { precioUnitario: number; cantidad: number }[]): number {
  return lineas.reduce((total, linea) => total + linea.precioUnitario * linea.cantidad, 0);
}

/**
 * Tiempo estimado del pedido completo: la demora del producto más lento.
 * Cocina y bar preparan en paralelo, así que sumar las demoras daría
 * tiempos irreales. 0 si no hay productos.
 */
export function calcularTiempoEstimado(demorasMin: number[]): number {
  return demorasMin.reduce((maximo, demora) => Math.max(maximo, demora), 0);
}
