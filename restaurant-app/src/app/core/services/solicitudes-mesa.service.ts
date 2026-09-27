import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { MiSolicitud, FilaListaEspera } from '../models/solicitud-mesa.model';
import { MesaRow } from '../models/mesa.model';
import { ResultadoOperacion } from '../models/resultado-operacion';

/** Red de seguridad por si el canal en tiempo real se corta (por ejemplo,
 *  se pierde la conexión un momento). Normalmente el cambio llega al toque. */
const INTERVALO_RESPALDO_MS = 30000;

/**
 * Solicitudes de mesa: todo lo que va desde que el cliente pide una mesa
 * hasta que queda vinculado a ella, del lado del cliente (anónimo o
 * registrado) y del lado del metre (lista de espera).
 *
 * Todo pasa por las RPC que ya existían en la base (no se crean nuevas).
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesMesaService {
  private readonly supabase = inject(SupabaseService);

  // ===== Lado del cliente =====

  /** Todas las mesas (libres u ocupadas): el cliente puede pedir
   *  cualquiera, aunque esté ocupada en este momento. */
  async listarMesasParaSolicitar(): Promise<MesaRow[]> {
    const { data, error } = await this.supabase.client.rpc('obtener_todas_mesas');
    if (error) {
      console.error('Error listando mesas:', error);
      return [];
    }
    return (data ?? []) as MesaRow[];
  }

  async obtenerMiSolicitud(clienteId: string): Promise<MiSolicitud | null> {
    const { data, error } = await this.supabase.client.rpc('obtener_mi_solicitud', {
      p_cliente_id: clienteId,
    });
    if (error) {
      console.error('Error obteniendo mi solicitud:', error);
      return null;
    }
    return (data as MiSolicitud) ?? null;
  }

  async crearSolicitud(clienteId: string, mesaId: string): Promise<ResultadoOperacion> {
    const { data, error } = await this.supabase.client.rpc('crear_solicitud_mesa', {
      p_cliente_id: clienteId,
      p_mesa_id: mesaId,
    });
    if (error) {
      console.error('Error creando solicitud:', error);
      return { ok: false, mensaje: 'No se pudo crear la solicitud.' };
    }
    return data as ResultadoOperacion;
  }

  /** El cliente escaneó el QR de una mesa — confirma que sea la que le
   *  asignaron y la marca como 'vinculado' si corresponde. */
  async vincularMesa(clienteId: string, mesaIdEscaneada: string): Promise<ResultadoOperacion> {
    const { data, error } = await this.supabase.client.rpc('vincular_mesa', {
      p_cliente_id: clienteId,
      p_mesa_id_escaneada: mesaIdEscaneada,
    });
    if (error) {
      console.error('Error vinculando mesa:', error);
      return { ok: false, mensaje: 'No se pudo vincular la mesa.' };
    }
    return data as ResultadoOperacion;
  }

  /**
   * Avisa cada vez que cambia la solicitud del cliente: apenas el metre la
   * acepta o rechaza, Supabase Realtime empuja el cambio y se vuelve a
   * leer. Un sondeo cada 30 segundos cubre el caso de que el canal se corte.
   *
   * Devuelve la función para dejar de observar (llamarla en ngOnDestroy),
   * igual que ConsultasService.suscribirse().
   */
  observarMiSolicitud(clienteId: string, alCambiar: (solicitud: MiSolicitud | null) => void): () => void {
    const refrescar = async () => alCambiar(await this.obtenerMiSolicitud(clienteId));

    const canal: RealtimeChannel = this.supabase.client
      .channel(`mi-solicitud-${clienteId}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'solicitudes_mesa', filter: `cliente_id=eq.${clienteId}` },
        () => refrescar()
      )
      .subscribe();

    const intervalo = setInterval(refrescar, INTERVALO_RESPALDO_MS);

    return () => {
      clearInterval(intervalo);
      this.supabase.client.removeChannel(canal);
    };
  }

  // ===== Lado del metre =====

  async listarListaEspera(): Promise<FilaListaEspera[]> {
    const { data, error } = await this.supabase.client.rpc('listar_lista_espera');
    if (error) {
      console.error('Error listando lista de espera:', error);
      return [];
    }
    return (data as FilaListaEspera[]) ?? [];
  }

  async aceptarSolicitud(solicitudId: string): Promise<ResultadoOperacion & { clienteId?: string }> {
    const { data, error } = await this.supabase.client.rpc('aceptar_solicitud_mesa', {
      p_solicitud_id: solicitudId,
    });
    if (error) {
      console.error('Error aceptando solicitud:', error);
      return { ok: false, mensaje: 'No se pudo aceptar la solicitud.' };
    }
    return data as ResultadoOperacion & { clienteId?: string };
  }

  async rechazarSolicitud(solicitudId: string): Promise<ResultadoOperacion & { clienteId?: string }> {
    const { data, error } = await this.supabase.client.rpc('rechazar_solicitud_mesa', {
      p_solicitud_id: solicitudId,
    });
    if (error) {
      console.error('Error rechazando solicitud:', error);
      return { ok: false, mensaje: 'No se pudo rechazar la solicitud.' };
    }
    return data as ResultadoOperacion & { clienteId?: string };
  }
}
