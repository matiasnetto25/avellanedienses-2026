import { Producto } from './producto.model';

/**
 * Pedido de una estadía (tablas "pedidos" y "pedido_items"), ya aplanado
 * para la pantalla: la mesa y el cliente salen del join con la estadía, y
 * el nombre y la demora de cada producto, del join con la carta.
 */

/** Los puntos 16 en adelante suman estados (en preparación, listo, etc.). */

export type EstadoPedido =
  | 'pendiente_confirmacion'
  | 'rechazado'
  | 'confirmado'
  /** Punto 19: el mozo lo llevó a la mesa y espera que el cliente confirme. */
  | 'pendiente_recepcion'
  /** Punto 19: lo pone solo el cliente, al confirmar que lo recibió. */
  | 'entregado'
  /** Punto 21: el cliente pidió la cuenta y espera al mozo. */
  | 'cuenta_pedida';

/** Los 5 niveles de propina de la consigna (punto 21), del mejor al peor: uno por QR. */
export const NIVELES_PROPINA: { porcentaje: number; etiqueta: string }[] = [
  { porcentaje: 20, etiqueta: 'Excelente' },
  { porcentaje: 15, etiqueta: 'Muy bueno' },
  { porcentaje: 10, etiqueta: 'Bueno' },
  { porcentaje: 5, etiqueta: 'Regular' },
  { porcentaje: 0, etiqueta: 'Malo' },
];

/** Medios de pago que ofrece el restaurante (punto 21). La base tiene la misma lista (pedidos_medio_pago_check). */
export type MedioPago = 'efectivo' | 'tarjeta' | 'mercado_pago';

export const MEDIOS_PAGO: { id: MedioPago; nombre: string; detalle: string; icono: string }[] = [
  { id: 'efectivo', nombre: 'Efectivo', detalle: 'Le pagás al mozo en la mesa.', icono: 'cash-outline' },
  { id: 'tarjeta', nombre: 'Tarjeta', detalle: 'Débito o crédito, con la terminal del mozo.', icono: 'card-outline' },
  { id: 'mercado_pago', nombre: 'Mercado Pago', detalle: 'Con el QR o el alias que te muestra el mozo.', icono: 'qr-code-outline' },
];

export function nombreMedioPago(medio: MedioPago | null): string | null {
  return MEDIOS_PAGO.find((m) => m.id === medio)?.nombre ?? null;
}

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

  /** Subtotal de los productos antes de aplicar descuentos. */
  subtotal: number;
  /** Porcentaje ganado en el juego para esta visita. */
  porcentajeDescuento: number;
  /** Importe descontado sobre el subtotal. */
  montoDescuento: number;
  /** Total final: subtotal menos descuento. */
  total: number;
  /** Punto 21: nivel elegido con el QR de propina. null hasta que el cliente escanea. */
  propinaPorcentaje: number | null;
  /** Propina sobre el subtotal, sin el descuento del juego. 0 mientras no hay propina. */
  montoPropina: number;
  /** Lo que paga el cliente: total con descuento más propina. */
  totalAPagar: number;
  /** Punto 21: cómo dice el cliente que va a pagar. null hasta que elige. */
  medioPago: MedioPago | null;
  /** Tiempo estimado del pedido. */
  tiempoEstimadoMin: number;
  items: PedidoItem[];

}

/**
 * Un renglón de la comanda de cocina o de bar (punto 14): un ítem de un
 * pedido confirmado, con la mesa y el nombre del producto ya aplanados.
 */
export interface ItemComanda {
  /** Id de la fila de pedido_items: los puntos 16 y 17 cambian su estado. */
  id: string;
  pedidoId: string;
  numeroMesa: number;
  /** Fecha ISO del pedido (created_at). Se formatea en la vista con DatePipe. */
  fecha: string;
  nombre: string;
  foto: string | null;
  cantidad: number;
  estado: EstadoItem;
}

/**
 * El mozo ya confirmó el pedido (punto 14): habilita los juegos. Se define
 * por lo que NO es, así los estados que sumen los puntos 16 en adelante
 * (en preparación, listo, etc.) cuentan como confirmados sin tocar nada.
 */
export function pedidoConfirmado(estado: EstadoPedido): boolean {
  return estado !== 'pendiente_confirmacion' && estado !== 'rechazado';
}

/**
 * El cliente ya recibió el pedido (punto 19): habilita la encuesta de
 * satisfacción (punto 20). Los estados posteriores a la entrega (la cuenta
 * pedida, y los que sumen los puntos 21 y 22) también cuentan.
 */
export function pedidoEntregado(estado: EstadoPedido): boolean {
  return estado === 'entregado' || estado === 'cuenta_pedida';
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
