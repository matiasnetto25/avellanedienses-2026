import type { EstadoCliente, EstadoEnEspera } from '../models/cliente.model';
import type { DisponibilidadMesa } from '../models/mesa.model';
import type { EstadoItem, EstadoPedido } from '../models/pedido.model';
import type { EstadoSolicitudMesa } from '../models/solicitud-mesa.model';

/**
 * Traducción de cada estado del código a cómo se ve en pantalla
 * (guía de estilos §7.5). Es el ÚNICO lugar con estos textos: ninguna
 * pantalla escribe «Por confirmar» ni muestra el valor crudo
 * `pendiente_confirmacion`.
 *
 * Se muestra con `<app-chip-estado [estado]="estadoPedido(p.estado)" />`.
 *
 * Cada mapa es un `Record<Estado, EstadoVisual>`: si mañana se agrega un
 * valor al tipo del modelo, esto no compila hasta asignarle tono, texto e ícono.
 *
 * Pendiente: «Cuenta pedida» (Espera, «Confirmando pago», `card-outline`)
 * se agrega cuando ese estado exista en el modelo.
 */

/** Espera: depende de que otro actúe · En curso: alguien lo trabaja · Listo: resuelto a favor · Rechazo: resuelto en contra. */
export type Tono = 'espera' | 'en-curso' | 'listo' | 'rechazo';

export interface EstadoVisual {
  tono: Tono;
  texto: string;
  /** Nombre de Ionicons; el chip ya los registra con `addIcons`. */
  icono: string;
}

const ESTADOS_PEDIDO: Record<EstadoPedido, EstadoVisual> = {
  pendiente_confirmacion: { tono: 'espera', texto: 'Por confirmar', icono: 'time-outline' },
  confirmado: { tono: 'listo', texto: 'Confirmado', icono: 'checkmark-circle-outline' },
  rechazado: { tono: 'rechazo', texto: 'Rechazado', icono: 'close-circle-outline' },
};

const ESTADOS_ITEM: Record<EstadoItem, EstadoVisual> = {
  pendiente: { tono: 'espera', texto: 'Pendiente', icono: 'time-outline' },
  en_preparacion: { tono: 'en-curso', texto: 'En preparación', icono: 'flame-outline' },
  listo: { tono: 'listo', texto: 'Listo', icono: 'checkmark-circle-outline' },
};

const ESTADOS_SOLICITUD_MESA: Record<EstadoSolicitudMesa, EstadoVisual> = {
  en_espera: { tono: 'espera', texto: 'En espera', icono: 'time-outline' },
  aceptado: { tono: 'en-curso', texto: 'Mesa asignada', icono: 'sync-outline' },
  vinculado: { tono: 'listo', texto: 'En la mesa', icono: 'checkmark-circle-outline' },
  rechazado: { tono: 'rechazo', texto: 'Rechazada', icono: 'close-circle-outline' },
};

const ESTADOS_EN_ESPERA: Record<EstadoEnEspera, EstadoVisual> = {
  en_la_lista: { tono: 'espera', texto: 'En la lista', icono: 'people-outline' },
  en_el_salon: { tono: 'listo', texto: 'En el salón', icono: 'checkmark-circle-outline' },
  rechazado: { tono: 'rechazo', texto: 'Rechazado', icono: 'close-circle-outline' },
};

/** `anonimo` va en `null`: el cliente anónimo no lleva chip. */
const ESTADOS_CLIENTE: Record<EstadoCliente, EstadoVisual | null> = {
  pendiente: { tono: 'espera', texto: 'Pendiente de aprobación', icono: 'time-outline' },
  aprobado: { tono: 'listo', texto: 'Aprobado', icono: 'checkmark-circle-outline' },
  rechazado: { tono: 'rechazo', texto: 'Rechazado', icono: 'close-circle-outline' },
  anonimo: null,
};

/** Una mesa ocupada no es un error: va en Espera, no en Rechazo. */
const ESTADOS_MESA: Record<DisponibilidadMesa, EstadoVisual> = {
  Libre: { tono: 'listo', texto: 'Libre', icono: 'checkmark-circle-outline' },
  Ocupada: { tono: 'espera', texto: 'Ocupada', icono: 'people-outline' },
};

export function estadoPedido(e: EstadoPedido): EstadoVisual {
  return ESTADOS_PEDIDO[e];
}

export function estadoItem(e: EstadoItem): EstadoVisual {
  return ESTADOS_ITEM[e];
}

export function estadoSolicitudMesa(e: EstadoSolicitudMesa): EstadoVisual {
  return ESTADOS_SOLICITUD_MESA[e];
}

export function estadoEnEspera(e: EstadoEnEspera): EstadoVisual {
  return ESTADOS_EN_ESPERA[e];
}

/** Devuelve `null` para el anónimo: la pantalla no muestra chip. */
export function estadoCliente(e: EstadoCliente): EstadoVisual | null {
  return ESTADOS_CLIENTE[e];
}

export function estadoMesa(d: DisponibilidadMesa): EstadoVisual {
  return ESTADOS_MESA[d];
}
