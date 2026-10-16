import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PartidaSommelier, RespuestaSommelier } from '../models/juego-sommelier.model';

/**
 * «El Sommelier Perfecto». Los niveles objetivo se sortean y el resultado se
 * calcula en la base (funciones iniciar / servir): el celular solo informa
 * cuánto tiempo mantuvo apretado el botón.
 */
@Injectable({ providedIn: 'root' })
export class JuegoSommelierService {
  private readonly supabase = inject(SupabaseService);

  /** La partida de esta estadía, o null si todavía no empezó. */
  async obtenerMiPartida(clienteId: string): Promise<PartidaSommelier | null> {
    const { data, error } = await this.supabase.client.rpc('obtener_mi_juego_sommelier', {
      p_cliente_id: clienteId,
    });
    if (error) {
      console.error('Error obteniendo la partida de sommelier:', error);
      return null;
    }
    return (data as PartidaSommelier | null) ?? null;
  }

  async iniciar(clienteId: string): Promise<RespuestaSommelier> {
    return this.llamar('iniciar_juego_sommelier', { p_cliente_id: clienteId });
  }

  async servir(clienteId: string, copa: number, milisegundos: number): Promise<RespuestaSommelier> {
    return this.llamar('servir_copa_sommelier', {
      p_cliente_id: clienteId,
      p_copa: copa,
      p_ms: Math.round(milisegundos),
    });
  }

  private async llamar(funcion: string, parametros: Record<string, unknown>): Promise<RespuestaSommelier> {
    const { data, error } = await this.supabase.client.rpc(funcion, parametros);
    if (error) {
      console.error(`Error en ${funcion}:`, error);
      return { ok: false, mensaje: 'No se pudo completar la acción. Intentá de nuevo.' };
    }
    return data as RespuestaSommelier;
  }
}