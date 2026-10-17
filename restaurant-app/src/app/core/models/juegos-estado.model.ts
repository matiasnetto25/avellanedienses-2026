export type JuegoConDescuento = 'carta' | 'sommelier' | 'ruleta';

/** Reglas de descuento de los juegos para el cliente en esta estadía. */
export interface EstadoJuegos {
  /** Solo el cliente registrado puede obtener descuento. */
  registrado: boolean;
  /** El juego que ya generó (o está generando) el descuento de la visita, o null. */
  juegoDescuento: JuegoConDescuento | null;
  /** true si todavía puede generar el descuento en el juego que elija. */
  puedeDescuento: boolean;
}

/** ¿Este juego genera descuento para el cliente? (si no, es una partida de práctica) */
export function generaDescuento(estado: EstadoJuegos | null, juego: JuegoConDescuento): boolean {
  if (!estado || !estado.registrado) return false;
  return estado.puedeDescuento || estado.juegoDescuento === juego;
}

/** Por qué un juego no da descuento (null si lo da). */
export function motivoSinDescuento(estado: EstadoJuegos | null, juego: JuegoConDescuento): string | null {
  if (generaDescuento(estado, juego)) return null;
  if (estado && !estado.registrado) return 'Jugás como invitado: los descuentos son solo para clientes registrados.';
  return 'Ya participaste por el descuento de esta visita en otro juego, así que este no suma descuento.';
}
