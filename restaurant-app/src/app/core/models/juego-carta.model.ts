/** Juego «Adiviná la carta» (descuento de hasta 20 %). */

export type PaloCarta = 'pica' | 'corazon' | 'trebol' | 'diamante';
export type TipoCarta = 'numero' | 'letra';
export type ValorCarta = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface OpcionPalo {
  palo: PaloCarta;
  etiqueta: string;
  simbolo: string;
  /** Corazón y diamante se dibujan en rojo. */
  rojo: boolean;
}

export const PALOS: readonly OpcionPalo[] = [
  { palo: 'pica', etiqueta: 'Pica', simbolo: '♠', rojo: false },
  { palo: 'corazon', etiqueta: 'Corazón', simbolo: '♥', rojo: true },
  { palo: 'trebol', etiqueta: 'Trébol', simbolo: '♣', rojo: false },
  { palo: 'diamante', etiqueta: 'Diamante', simbolo: '♦', rojo: true },
];

/** El As cuenta como letra en este juego (A, J, Q, K). */
export const VALORES_POR_TIPO: Record<TipoCarta, readonly ValorCarta[]> = {
  numero: ['2', '3', '4', '5', '6', '7', '8', '9', '10'],
  letra: ['A', 'J', 'Q', 'K'],
};

export const DESCUENTO_POR_ACIERTOS: Record<number, number> = { 0: 0, 1: 10, 2: 15, 3: 20 };

export function simboloPalo(palo: PaloCarta): string {
  return PALOS.find(p => p.palo === palo)?.simbolo ?? '';
}

export function etiquetaPalo(palo: PaloCarta): string {
  return PALOS.find(p => p.palo === palo)?.etiqueta ?? palo;
}

export function etiquetaValor(valor: ValorCarta): string {
  return valor === 'A' ? 'As' : valor;
}

export interface ResultadoJuegoCarta {
  /** La carta que estaba oculta. */
  carta: { palo: PaloCarta; valor: ValorCarta };
  eleccion: { palo: PaloCarta; tipo: TipoCarta; valor: ValorCarta };
  aciertos: { palo: boolean; tipo: boolean; valor: boolean };
  cantidad: number;
  /** 0, 10, 15 o 20. En una partida de práctica siempre es 0. */
  descuento: number;
  /** true desde la segunda partida de la estadía: se juega, pero no da descuento. */
  practica?: boolean;
  /** En práctica: el descuento que dio la primera partida. */
  descuentoGanado?: number;
}

export interface RespuestaJuegoCarta {
  ok: boolean;
  mensaje?: string;
  resultado?: ResultadoJuegoCarta;
}