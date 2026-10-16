import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { RespuestaRuleta, ResultadoRuleta } from '../models/juego-ruleta.model';

/**
 * «Ruleta de la Suerte». El segmento ganador lo sortea y lo guarda la base de
 * datos (función girar_ruleta); el celular solo anima el giro hacia él.
 */
@Injectable({ providedIn: 'root' })
export class JuegoRuletaService {
  private readonly supabase = inject(SupabaseService);

  /** El giro de esta estadía, o null si todavía no giró. */
  async obtenerMiGiro(clienteId: string): Promise<ResultadoRuleta | null> {
    const { data, error } = await this.supabase.client.rpc('obtener_mi_juego_ruleta', {
      p_cliente_id: clienteId,
    });
    if (error) {
      console.error('Error obteniendo mi giro:', error);
      return null;
    }
    return (data as ResultadoRuleta | null) ?? null;
  }

  async girar(clienteId: string): Promise<RespuestaRuleta> {
    const { data, error } = await this.supabase.client.rpc('girar_ruleta', { p_cliente_id: clienteId });
    if (error) {
      console.error('Error girando la ruleta:', error);
      return { ok: false, mensaje: 'No se pudo girar en este momento. Intentá de nuevo.' };
    }
    return data as RespuestaRuleta;
  }
}
