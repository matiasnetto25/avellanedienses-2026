/** «Ruleta de la Suerte»: 8 segmentos iguales. El orden es el mismo que en la función SQL girar_ruleta. */
export const PREMIO_POR_SEGMENTO: readonly number[] = [10, 0, 15, 0, 20, 0, 0, 0];

export const SEGMENTOS_RULETA = PREMIO_POR_SEGMENTO.length;

export interface ResultadoRuleta {
  /** 0 a 7, contado desde arriba en sentido horario. */
  segmento: number;
  /** 0 (sin premio), 10, 15 o 20. */
  premio: number;
}

export interface RespuestaRuleta {
  ok: boolean;
  mensaje?: string;
  resultado?: ResultadoRuleta;
}
