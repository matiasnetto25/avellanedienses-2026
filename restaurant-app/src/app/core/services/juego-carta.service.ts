import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { PaloCarta, RespuestaJuegoCarta, ResultadoJuegoCarta, TipoCarta, ValorCarta } from '../models/juego-carta.model';

/**
 * Juego «Adiviná la carta». La carta oculta la sortea y la compara la base de
 * datos (función jugar_adivina_carta): el celular nunca la conoce antes de
 * confirmar, y se juega una sola vez por estadía.
 */
@Injectable({ providedIn: 'root' })
export class JuegoCartaService {
  private readonly supabase = inject(SupabaseService);

  /** La partida de esta estadía, o null si todavía no jugó. */
  async obtenerMiPartida(clienteId: string): Promise<ResultadoJuegoCarta | null> {
    const { data, error } = await this.supabase.client.rpc('obtener_mi_juego_carta', {
      p_cliente_id: clienteId,
    });
    if (error) {
      console.error('Error obteniendo mi partida:', error);
      return null;
    }
    return (data as ResultadoJuegoCarta | null) ?? null;
  }

  async jugar(clienteId: string, palo: PaloCarta, tipo: TipoCarta, valor: ValorCarta): Promise<RespuestaJuegoCarta> {
    const { data, error } = await this.supabase.client.rpc('jugar_adivina_carta', {
      p_cliente_id: clienteId,
      p_palo: palo,
      p_tipo: tipo,
      p_valor: valor,
    });
    if (error) {
      console.error('Error jugando:', error);
      return { ok: false, mensaje: 'No se pudo jugar en este momento. Intentá de nuevo.' };
    }
    return data as RespuestaJuegoCarta;
  }
}