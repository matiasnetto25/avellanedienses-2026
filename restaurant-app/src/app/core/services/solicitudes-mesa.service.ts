import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { MiSolicitud, FilaListaEspera } from '../models/solicitud-mesa.model';
import { MesaRow } from '../models/mesa.model';
import { ResultadoOperacion } from '../models/resultado-operacion';

/** Red de seguridad por si el canal en tiempo real se corta (por ejemplo,
 *  se pierde la conexión un momento). Normalmente el cambio llega al toque. */
const INTERVALO_RESPALDO_MS = 30000;

export interface ResultadoAsignacion extends ResultadoOperacion {
  cliente_id?: string;
  mesa_id?: string;
  numero_mesa?: number;
}

/**
 * Solicitudes de mesa: todo lo que va desde que el cliente escanea el QR de
 * ingreso hasta que queda vinculado a su mesa, del lado del cliente (anónimo
 * o registrado) y del lado del metre (lista de espera).
 *
 * Circuito: el cliente se anota sin mesa (solicitarIngreso) → el metre le
 * asigna una mesa libre (asignarMesa) → el cliente escanea el QR de esa mesa
 * (vincularMesa).
 */
@Injectable({ providedIn: 'root' })
export class SolicitudesMesaService {
  private readonly supabase = inject(SupabaseService);

  // ===== Lado del cliente =====

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

  /** Lugar en la lista de espera (1 = el próximo), o null si no se pudo calcular. */
  async obtenerPosicionEnLista(solicitudId: string): Promise<number | null> {
    const { data: propia, error } = await this.supabase.client
      .from('solicitudes_mesa')
      .select('created_at')
      .eq('id', solicitudId)
      .maybeSingle();
    if (error || !propia) return null;

    const { count, error: errorConteo } = await this.supabase.client
      .from('solicitudes_mesa')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'en_espera')
      .lt('created_at', propia.created_at);
    if (errorConteo || count === null) return null;

    return count + 1;
  }

  /** El cliente escaneó el QR de ingreso: se anota en la lista de espera, sin mesa. */
  async solicitarIngreso(clienteId: string): Promise<ResultadoOperacion> {
    const { data, error } = await this.supabase.client.rpc('solicitar_ingreso', {
      p_cliente_id: clienteId,
    });
    if (error) {
      console.error('Error solicitando el ingreso:', error);
      return { ok: false, mensaje: 'No se pudo anotarte en la lista de espera.' };
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
   * Termina la estadía (punto 22): con el pago ya confirmado, el cliente
   * escaneó el QR de su mesa. Marca la solicitud como finalizada y libera
   * la mesa. Primero la solicitud: si falla, no se toca la mesa. Los
   * filtros por estado reemplazan a RLS, que está desactivado en la base.
   */
  async finalizarEstadia(solicitudId: string, mesaId: string): Promise<ResultadoOperacion> {
    try {
      const { data, error } = await this.supabase.client
        .from('solicitudes_mesa')
        .update({ estado: 'finalizado' })
        .eq('id', solicitudId)
        .eq('estado', 'vinculado')
        .select('id');
      if (error) {
        console.error('Error finalizando la estadía:', error);
        return { ok: false, mensaje: 'No se pudo terminar la visita. Probá de nuevo.' };
      }
      if (!data?.length) return { ok: false, mensaje: 'Tu visita ya estaba terminada.' };

      // .select('id') para saber si el update tocó la fila: con RLS activo y sin
      // política, Postgres no da error, simplemente no actualiza nada.
      const { data: mesas, error: errorMesa } = await this.supabase.client
        .from('mesa')
        .update({ disponibilidad: 'Libre' })
        .eq('id', mesaId)
        .select('id');
      if (errorMesa || !mesas?.length) {
        console.error('Error liberando la mesa:', errorMesa ?? 'el update no tocó ninguna fila (¿RLS?)');
        return { ok: false, mensaje: 'Terminaste la visita, pero no se pudo liberar la mesa. Avisale al mozo.' };
      }
      return { ok: true };
    } catch (error: unknown) {
      console.error('Error inesperado finalizando la estadía:', error);
      return { ok: false, mensaje: 'No se pudo terminar la visita. Revisá tu conexión.' };
    }
  }

  /**
   * Avisa cada vez que cambia la solicitud del cliente: apenas el metre le
   * asigna mesa o la rechaza, Supabase Realtime empuja el cambio y se vuelve a
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

  observarListaEspera(alCambiar: () => void): () => void {
    const canal: RealtimeChannel = this.supabase.client
      .channel(`lista-espera-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_mesa' }, () => alCambiar())
      .subscribe();

    const intervalo = setInterval(alCambiar, INTERVALO_RESPALDO_MS);

    return () => {
      clearInterval(intervalo);
      this.supabase.client.removeChannel(canal);
    };
  }

  async listarListaEspera(): Promise<FilaListaEspera[]> {
    const { data, error } = await this.supabase.client.rpc('listar_lista_espera');
    if (error) {
      console.error('Error listando lista de espera:', error);
      return [];
    }
    return (data as FilaListaEspera[]) ?? [];
  }

  /** Mesas libres en este momento: las únicas que el metre puede asignar. */
  async listarMesasLibres(): Promise<MesaRow[]> {
    const { data, error } = await this.supabase.client.rpc('obtener_mesas_libres');
    if (error) {
      console.error('Error listando mesas libres:', error);
      return [];
    }
    return (data ?? []) as MesaRow[];
  }

  /** El metre le asigna una mesa libre a una solicitud en espera. */
  async asignarMesa(solicitudId: string, mesaId: string): Promise<ResultadoAsignacion> {
    const { data, error } = await this.supabase.client.rpc('asignar_mesa_solicitud', {
      p_solicitud_id: solicitudId,
      p_mesa_id: mesaId,
    });
    if (error) {
      console.error('Error asignando mesa:', error);
      return { ok: false, mensaje: 'No se pudo asignar la mesa.' };
    }
    return data as ResultadoAsignacion;
  }

  async rechazarSolicitud(solicitudId: string): Promise<ResultadoOperacion & { cliente_id?: string }> {
    const { data, error } = await this.supabase.client.rpc('rechazar_solicitud_mesa', {
      p_solicitud_id: solicitudId,
    });
    if (error) {
      console.error('Error rechazando solicitud:', error);
      return { ok: false, mensaje: 'No se pudo rechazar la solicitud.' };
    }
    return data as ResultadoOperacion & { cliente_id?: string };
  }
}