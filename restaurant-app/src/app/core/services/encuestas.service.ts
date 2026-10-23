import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  AspectoDestacado,
  AtencionMozo,
  NuevaEncuesta,
  ResultadosEncuestas,
  RespuestaEncuesta,
  agregarResultados,
} from '../models/encuesta.model';
import { ResultadoOperacion } from '../models/resultado-operacion';
import { ResultadoBusqueda } from '../models/resultado-busqueda';

const TABLA_ENCUESTAS = 'encuestas';

/** Lo que leen los gráficos: sin el comentario ni la estadía. */
const SELECT_RESULTADOS = 'calificacion_general, atencion_mozo, limpieza, aspectos_destacados, recomendaria, created_at';

/** Códigos de Postgres que se traducen a mensajes para el cliente. */
const CODIGO_DUPLICADO = '23505';
const CODIGO_RLS = '42501';
const CODIGO_CHECK = '23514';

interface RespuestaFila {
  calificacion_general: number;
  atencion_mozo: AtencionMozo;
  limpieza: number;
  aspectos_destacados: AspectoDestacado[];
  recomendaria: boolean;
  created_at: string;
}

/**
 * Único punto de la app que crea y lee las encuestas de satisfacción
 * (punto 20).
 *
 * Sin RPC: la encuesta se crea con un insert directo. La base garantiza
 * una por estadía (unique en solicitud_id) y valida cada respuesta (check).
 * La regla «solo con el pedido confirmado» la aplican
 * EtapaClienteService.encuestaHabilitada y encuestaGuard: la política de
 * insert existe, pero la base de prueba tiene RLS desactivado.
 *
 * Los gráficos se calculan acá (agregarResultados), a partir de un solo
 * select: sin vistas ni funciones en la base.
 */
@Injectable({ providedIn: 'root' })
export class EncuestasService {
  private readonly supabase = inject(SupabaseService);

  /** Guarda la encuesta de la estadía. El formulario ya validó las respuestas. */
  async crear(solicitudId: string, encuesta: NuevaEncuesta): Promise<ResultadoOperacion> {
    const comentario = encuesta.comentario?.trim() || null;
    const { error } = await this.supabase.client.from(TABLA_ENCUESTAS).insert({
      solicitud_id: solicitudId,
      calificacion_general: encuesta.calificacionGeneral,
      atencion_mozo: encuesta.atencionMozo,
      limpieza: encuesta.limpieza,
      aspectos_destacados: encuesta.aspectosDestacados,
      recomendaria: encuesta.recomendaria,
      comentario,
    });

    if (error) {
      console.error('Error creando la encuesta:', error);
      if (error.code === CODIGO_DUPLICADO) {
        return { ok: false, mensaje: 'Ya completaste la encuesta de esta visita.' };
      }
      if (error.code === CODIGO_RLS) {
        return { ok: false, mensaje: 'La encuesta se habilita cuando el mozo confirma tu pedido.' };
      }
      if (error.code === CODIGO_CHECK) {
        return { ok: false, mensaje: 'Revisá las respuestas de la encuesta.' };
      }
      return { ok: false, mensaje: 'No se pudo enviar la encuesta. Revisá tu conexión.' };
    }
    return { ok: true };
  }

  /**
   * Si la estadía ya tiene encuesta. Distingue «no la completó»
   * ({ ok: true, dato: false }) de «falló la consulta» ({ ok: false }).
   */
  async estadiaTieneEncuesta(solicitudId: string): Promise<ResultadoBusqueda<boolean>> {
    const { data, error } = await this.supabase.client
      .from(TABLA_ENCUESTAS)
      .select('id')
      .eq('solicitud_id', solicitudId)
      .maybeSingle();
    if (error) {
      console.error('Error consultando la encuesta de la estadía:', error);
      return { ok: false };
    }
    return { ok: true, dato: data !== null };
  }

  /** Los datos de los cinco gráficos. null si falló la consulta. */
  async obtenerResultados(): Promise<ResultadosEncuestas | null> {
    const { data, error } = await this.supabase.client
      .from(TABLA_ENCUESTAS)
      .select(SELECT_RESULTADOS)
      .order('created_at', { ascending: true });
    if (error) {
      console.error('Error obteniendo los resultados de las encuestas:', error);
      return null;
    }
    return agregarResultados((data as RespuestaFila[]).map((fila) => this.aRespuesta(fila)));
  }

  private aRespuesta(fila: RespuestaFila): RespuestaEncuesta {
    return {
      calificacionGeneral: fila.calificacion_general,
      atencionMozo: fila.atencion_mozo,
      limpieza: fila.limpieza,
      aspectosDestacados: fila.aspectos_destacados,
      recomendaria: fila.recomendaria,
      creadaEn: fila.created_at,
    };
  }
}
