/**
 * Encuesta de satisfacción (punto 20): una por estadía, con una columna por
 * pregunta (tabla "encuestas"). Los valores son los mismos que aceptan los
 * check de la base (migración 20261018120000_encuestas.sql); las etiquetas
 * en español las comparten el formulario y los gráficos.
 */

export type AtencionMozo = 'excelente' | 'buena' | 'regular' | 'mala';
export type AspectoDestacado = 'comida' | 'bebidas' | 'atencion' | 'ambiente' | 'precio' | 'tiempo_espera';

/** En el orden en que se muestran en el formulario y en los gráficos. */
export const OPCIONES_ATENCION_MOZO: AtencionMozo[] = ['excelente', 'buena', 'regular', 'mala'];
export const OPCIONES_ASPECTO: AspectoDestacado[] = [
  'comida',
  'bebidas',
  'atencion',
  'ambiente',
  'precio',
  'tiempo_espera',
];

export const ETIQUETAS_ATENCION_MOZO: Record<AtencionMozo, string> = {
  excelente: 'Excelente',
  buena: 'Buena',
  regular: 'Regular',
  mala: 'Mala',
};

export const ETIQUETAS_ASPECTO: Record<AspectoDestacado, string> = {
  comida: 'Comida',
  bebidas: 'Bebidas',
  atencion: 'Atención',
  ambiente: 'Ambiente',
  precio: 'Precio',
  tiempo_espera: 'Tiempo de espera',
};

/** Rangos de las preguntas numéricas. La base tiene los mismos (encuestas_*_check). */
export const CALIFICACION_MIN = 1;
export const CALIFICACION_MAX = 5;
export const LIMPIEZA_MIN = 0;
export const LIMPIEZA_MAX = 10;
export const COMENTARIO_MAX = 300;

/** Lo que envía el formulario. La estadía la agrega EncuestasService. */
export interface NuevaEncuesta {
  calificacionGeneral: number;
  atencionMozo: AtencionMozo;
  limpieza: number;
  aspectosDestacados: AspectoDestacado[];
  recomendaria: boolean;
  /** null si el cliente no escribió nada (o solo espacios). */
  comentario: string | null;
}

/** Lo que leen los gráficos de cada encuesta (sin el comentario). */
export interface RespuestaEncuesta {
  calificacionGeneral: number;
  atencionMozo: AtencionMozo;
  limpieza: number;
  aspectosDestacados: AspectoDestacado[];
  recomendaria: boolean;
  /** Fecha ISO (created_at): agrupa el gráfico de limpieza por semana. */
  creadaEn: string;
}

/** Etiquetas y valores de un gráfico, en el mismo orden. */
export interface SerieGrafico {
  etiquetas: string[];
  valores: number[];
}

/** Los datos de los cinco gráficos de resultados (issue 04), ya agregados. */
export interface ResultadosEncuestas {
  total: number;
  /** Barras: cantidad de encuestas por estrella, de 1 a 5 (incluidas las que tienen cero). */
  calificacion: SerieGrafico;
  /** Torta: cantidad por opción. */
  atencionMozo: SerieGrafico;
  /** Línea: promedio de limpieza por semana, de la más vieja a la más nueva. */
  limpiezaPorSemana: SerieGrafico;
  /** Barras horizontales: veces que se marcó cada aspecto. */
  aspectos: SerieGrafico;
  /** Dona: cantidad de «Sí» y de «No». */
  recomendaria: SerieGrafico;
}

/**
 * Agrega las respuestas para los gráficos. Es una función pura (no lee la
 * base) para poder probarla con datos inventados; la usa
 * EncuestasService.obtenerResultados().
 */
export function agregarResultados(respuestas: RespuestaEncuesta[]): ResultadosEncuestas {
  const estrellas = Array.from({ length: CALIFICACION_MAX }, (_, i) => i + CALIFICACION_MIN);

  return {
    total: respuestas.length,
    calificacion: {
      etiquetas: estrellas.map((n) => (n === 1 ? '1 estrella' : `${n} estrellas`)),
      valores: estrellas.map((n) => respuestas.filter((r) => r.calificacionGeneral === n).length),
    },
    atencionMozo: {
      etiquetas: OPCIONES_ATENCION_MOZO.map((opcion) => ETIQUETAS_ATENCION_MOZO[opcion]),
      valores: OPCIONES_ATENCION_MOZO.map((opcion) => respuestas.filter((r) => r.atencionMozo === opcion).length),
    },
    limpiezaPorSemana: promedioLimpiezaPorSemana(respuestas),
    aspectos: {
      etiquetas: OPCIONES_ASPECTO.map((aspecto) => ETIQUETAS_ASPECTO[aspecto]),
      valores: OPCIONES_ASPECTO.map(
        (aspecto) => respuestas.filter((r) => r.aspectosDestacados.includes(aspecto)).length
      ),
    },
    recomendaria: {
      etiquetas: ['Sí', 'No'],
      valores: [
        respuestas.filter((r) => r.recomendaria).length,
        respuestas.filter((r) => !r.recomendaria).length,
      ],
    },
  };
}

/**
 * Agrupa por semana (de lunes a domingo, en la hora del dispositivo) y
 * promedia la limpieza con un decimal. Solo aparecen las semanas que
 * tienen encuestas. La etiqueta es el lunes de la semana («06/10»).
 */
function promedioLimpiezaPorSemana(respuestas: RespuestaEncuesta[]): SerieGrafico {
  const porSemana = new Map<number, number[]>();
  for (const respuesta of respuestas) {
    const lunes = lunesDeLaSemana(new Date(respuesta.creadaEn)).getTime();
    porSemana.set(lunes, [...(porSemana.get(lunes) ?? []), respuesta.limpieza]);
  }

  const semanas = [...porSemana.keys()].sort((a, b) => a - b);
  return {
    etiquetas: semanas.map((lunes) => formatearDiaMes(new Date(lunes))),
    valores: semanas.map((lunes) => {
      const valores = porSemana.get(lunes)!;
      const promedio = valores.reduce((suma, valor) => suma + valor, 0) / valores.length;
      return Math.round(promedio * 10) / 10;
    }),
  };
}

function lunesDeLaSemana(fecha: Date): Date {
  const lunes = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  // getDay(): 0 es domingo. Días desde el lunes: lunes 0, domingo 6.
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return lunes;
}

function formatearDiaMes(fecha: Date): string {
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dia}/${mes}`;
}
