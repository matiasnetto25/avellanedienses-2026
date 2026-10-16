import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { EstadoJuegos } from '../models/juegos-estado.model';

/** Qué juego generó el descuento de la visita y si este cliente puede obtenerlo. */
@Injectable({ providedIn: 'root' })
export class JuegosEstadoService {
  private readonly supabase = inject(SupabaseService);

  /** null si no se pudo consultar (el juego entonces se trata como práctica). */
  async obtener(clienteId: string): Promise<EstadoJuegos | null> {
    const { data, error } = await this.supabase.client.rpc('obtener_estado_juegos', {
      p_cliente_id: clienteId,
    });
    if (error) {
      console.error('Error obteniendo el estado de los juegos:', error);
      return null;
    }
    return (data as EstadoJuegos | null) ?? null;
  }
}
