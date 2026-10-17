/** «El Sommelier Perfecto»: constantes y tipos compartidos con la base de datos. */

/** Velocidad constante de llenado: 20 % por segundo (100 % en 5 s). Igual que en la función SQL. */
export const SOMMELIER_PORCENTAJE_POR_MS = 0.02;
export const SOMMELIER_MS_MAXIMO = 5000;
/** Una copa está bien servida si queda a ±5 puntos del objetivo. */
export const SOMMELIER_TOLERANCIA = 5;
export const SOMMELIER_COPAS = 3;

export const DESCUENTO_POR_COPAS: Record<number, number> = { 0: 0, 1: 10, 2: 15, 3: 20 };

export type ResultadoCopa = 'perfecto' | 'corto' | 'pasado';

export interface CopaSommelier {
  numero: number;
  objetivo: number;
  nivel: number;
  resultado: ResultadoCopa;
}

export interface PartidaSommelier {
  estado: 'en_curso' | 'finalizada';
  copasServidas: number;
  /** Objetivo de la copa que sigue (null cuando la partida terminó). */
  objetivoActual: number | null;
  aciertos: number | null;
  descuento: number | null;
  copas: CopaSommelier[];
}

export interface RespuestaSommelier {
  ok: boolean;
  mensaje?: string;
  partida?: PartidaSommelier;
  copa?: CopaSommelier;
}