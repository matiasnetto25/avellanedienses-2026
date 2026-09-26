import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import {
  ConversacionActiva,
  MAX_CARACTERES_MENSAJE,
  MensajeMesa,
} from '../models/consulta.model';

const TABLA_MENSAJES = 'mensajes_mesa';

/**
 * Joins por clave foránea (embedding de Supabase): mensaje → empleado, y
 * mensaje → estadía → mesa / cliente. Así el número de mesa y el autor
 * salen de la base y no los puede falsear la app.
 */
const SELECT_MENSAJE = `
  id, created_at, solicitud_id, texto, empleado_id,
  empleado:empleados ( nombre, apellido ),
  solicitud:solicitudes_mesa (
    cliente_id,
    mesa ( numero_mesa ),
    cliente:clientes ( nombre, apellido )
  )
`;

const SELECT_CONVERSACION = `
  id, cliente_id,
  mesa ( numero_mesa ),
  cliente:clientes ( nombre, apellido ),
  mensajes:mensajes_mesa ( texto, created_at, empleado_id )
`;

/** Código de Postgres cuando una política RLS rechaza el insert. */
const CODIGO_RLS = '42501';

export interface ResultadoEnvio {
  ok: boolean;
  mensaje?: string;
  /** El mensaje recién guardado, para mostrarlo sin esperar a Realtime. */
  mensajeGuardado?: MensajeMesa;
}

interface NombreFila {
  nombre: string;
  apellido: string | null;
}

interface MensajeFila {
  id: string;
  created_at: string;
  solicitud_id: string;
  texto: string;
  empleado_id: number | null;
  empleado: NombreFila | null;
  solicitud: {
    cliente_id: string;
    mesa: { numero_mesa: number };
    cliente: NombreFila;
  };
}

interface ConversacionFila {
  id: string;
  cliente_id: string;
  mesa: { numero_mesa: number };
  cliente: NombreFila;
  mensajes: { texto: string; created_at: string; empleado_id: number | null }[];
}

/**
 * Único punto de la app que lee, envía y escucha los mensajes del chat de
 * cada estadía (punto 11). Lo usan el chat del cliente, el del mozo y la
 * lista de conversaciones del mozo.
 *
 * No envía push: las disparan las pantallas (ver NotificacionesService).
 */
@Injectable({ providedIn: 'root' })
export class ConsultasService {
  private readonly supabase = inject(SupabaseService);

  // ===== Lectura =====

  /** Mensajes de una estadía, del más viejo al más nuevo. */
  async listar(solicitudId: string): Promise<MensajeMesa[] | null> {
    const { data, error } = await this.supabase.client
      .from(TABLA_MENSAJES)
      .select(SELECT_MENSAJE)
      .eq('solicitud_id', solicitudId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error listando mensajes:', error);
      return null;
    }
    return (data as unknown as MensajeFila[]).map((fila) => this.aMensaje(fila));
  }

  /**
   * Estadías vinculadas con su último mensaje, para la lista del mozo.
   * Primero las que tienen actividad más reciente; al final, las que
   * todavía no tienen mensajes.
   */
  async listarConversaciones(): Promise<ConversacionActiva[] | null> {
    const { data, error } = await this.supabase.client
      .from('solicitudes_mesa')
      .select(SELECT_CONVERSACION)
      .eq('estado', 'vinculado')
      .order('created_at', { referencedTable: TABLA_MENSAJES, ascending: false })
      .limit(1, { referencedTable: TABLA_MENSAJES });

    if (error) {
      console.error('Error listando conversaciones:', error);
      return null;
    }

    return (data as unknown as ConversacionFila[])
      .map((fila) => this.aConversacion(fila))
      .sort((a, b) => (b.ultimo_created_at ?? '').localeCompare(a.ultimo_created_at ?? ''));
  }

  /** Una estadía vinculada (mesa, cliente y último mensaje), o null si ya no está vinculada. */
  async obtenerConversacion(solicitudId: string): Promise<ConversacionActiva | null> {
    const { data, error } = await this.supabase.client
      .from('solicitudes_mesa')
      .select(SELECT_CONVERSACION)
      .eq('id', solicitudId)
      .eq('estado', 'vinculado')
      .order('created_at', { referencedTable: TABLA_MENSAJES, ascending: false })
      .limit(1, { referencedTable: TABLA_MENSAJES })
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Error obteniendo conversación:', error);
      return null;
    }
    return this.aConversacion(data as unknown as ConversacionFila);
  }

  // ===== Envío =====

  async enviarComoCliente(solicitudId: string, texto: string): Promise<ResultadoEnvio> {
    return this.enviar(
      { solicitud_id: solicitudId, texto },
      'Tu mesa ya no está habilitada para consultar al mozo.'
    );
  }

  async enviarComoMozo(solicitudId: string, empleadoId: number, texto: string): Promise<ResultadoEnvio> {
    return this.enviar(
      { solicitud_id: solicitudId, empleado_id: empleadoId, texto },
      'No podés responder en este chat: la mesa ya no está vinculada o no tenés el puesto de mozo.'
    );
  }

  /** Devuelve el mensaje de error de validación, o null si el texto es válido. */
  validarTexto(texto: string): string | null {
    const limpio = texto.trim();
    if (limpio.length === 0) return 'Escribí un mensaje antes de enviarlo.';
    if (limpio.length > MAX_CARACTERES_MENSAJE) {
      return `El mensaje no puede superar los ${MAX_CARACTERES_MENSAJE} caracteres.`;
    }
    return null;
  }

  private async enviar(
    fila: { solicitud_id: string; empleado_id?: number; texto: string },
    mensajeRechazo: string
  ): Promise<ResultadoEnvio> {
    const errorValidacion = this.validarTexto(fila.texto);
    if (errorValidacion) return { ok: false, mensaje: errorValidacion };

    try {
      const { data, error } = await this.supabase.client
        .from(TABLA_MENSAJES)
        .insert({ ...fila, texto: fila.texto.trim() })
        .select(SELECT_MENSAJE)
        .single();

      if (error) {
        console.error('Error enviando mensaje:', error);
        if (error.code === CODIGO_RLS) return { ok: false, mensaje: mensajeRechazo };
        return { ok: false, mensaje: 'No se pudo enviar el mensaje. Probá de nuevo.' };
      }

      return { ok: true, mensajeGuardado: this.aMensaje(data as unknown as MensajeFila) };
    } catch (error: unknown) {
      console.error('Error inesperado enviando mensaje:', error);
      return { ok: false, mensaje: 'No se pudo enviar el mensaje. Revisá tu conexión.' };
    }
  }

  // ===== Tiempo real =====

  /**
   * Avisa cada mensaje nuevo. Con solicitudId, solo los de esa estadía
   * (chat); con null, los de todas (lista de conversaciones del mozo).
   *
   * Realtime entrega la fila cruda, sin joins: por eso se vuelve a pedir
   * el mensaje por id antes de avisar. Devuelve la función que cierra el
   * canal; las pantallas la llaman en ngOnDestroy.
   */
  suscribirse(solicitudId: string | null, alNuevoMensaje: (mensaje: MensajeMesa) => void): () => void {
    const canal: RealtimeChannel = this.supabase.client
      .channel(`mensajes-mesa-${solicitudId ?? 'todas'}-${crypto.randomUUID()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLA_MENSAJES,
          ...(solicitudId ? { filter: `solicitud_id=eq.${solicitudId}` } : {}),
        },
        async (payload) => {
          const mensaje = await this.obtenerPorId((payload.new as { id: string }).id);
          if (mensaje) alNuevoMensaje(mensaje);
        }
      )
      .subscribe();

    return () => {
      this.supabase.client.removeChannel(canal);
    };
  }

  private async obtenerPorId(id: string): Promise<MensajeMesa | null> {
    const { data, error } = await this.supabase.client
      .from(TABLA_MENSAJES)
      .select(SELECT_MENSAJE)
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      console.error('Error obteniendo mensaje nuevo:', error);
      return null;
    }
    return this.aMensaje(data as unknown as MensajeFila);
  }

  // ===== Mapeo de la respuesta anidada al modelo de la pantalla =====

  private aMensaje(fila: MensajeFila): MensajeMesa {
    const autor = fila.empleado_id === null ? fila.solicitud.cliente : fila.empleado;
    return {
      id: fila.id,
      created_at: fila.created_at,
      solicitud_id: fila.solicitud_id,
      empleado_id: fila.empleado_id,
      texto: fila.texto,
      numero_mesa: fila.solicitud.mesa.numero_mesa,
      cliente_id: fila.solicitud.cliente_id,
      autor_nombre: this.nombreCompleto(autor),
    };
  }

  private aConversacion(fila: ConversacionFila): ConversacionActiva {
    const ultimo = fila.mensajes[0] ?? null;
    return {
      solicitud_id: fila.id,
      cliente_id: fila.cliente_id,
      numero_mesa: fila.mesa.numero_mesa,
      cliente_nombre: this.nombreCompleto(fila.cliente),
      ultimo_texto: ultimo?.texto ?? null,
      ultimo_created_at: ultimo?.created_at ?? null,
      sin_responder: ultimo !== null && ultimo.empleado_id === null,
    };
  }

  private nombreCompleto(persona: NombreFila | null): string {
    if (!persona) return '';
    return [persona.nombre, persona.apellido]
      .map((parte) => parte?.trim())
      .filter(Boolean)
      .join(' ');
  }
}
