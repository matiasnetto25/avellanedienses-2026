import { Injectable, inject } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { BUCKETS } from '../storage-buckets';
import { ClienteRow, EstadoCliente, EstadoEnEspera, NuevoClienteRegistrado } from '../models/cliente.model';
import { plantillaClienteAprobado, plantillaClienteRechazado } from '../emails/email-templates';
import { ResultadoBusqueda } from '../models/resultado-busqueda';

const TABLA_CLIENTES = 'clientes';
const INTERVALO_RESPALDO_MS = 30000;

export interface ResultadoAltaCliente {
  ok: boolean;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private readonly supabase = inject(SupabaseService);

  async existeEmail(email: string): Promise<boolean> {
    const correo = email.trim().toLowerCase();
    const { data, error } = await this.supabase.client
      .from(TABLA_CLIENTES)
      .select('id')
      .eq('email', correo)
      .maybeSingle();

    if (error) {
      console.error('Error consultando email de cliente:', error);
      return false;
    }
    return !!data;
  }

  async existeDni(dni: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from(TABLA_CLIENTES)
      .select('id')
      .eq('dni', dni)
      .maybeSingle();

    if (error) {
      console.error('Error consultando DNI de cliente:', error);
      return false;
    }
    return !!data;
  }

  /** Foto de un cliente, anónimo o registrado (los dos usan el mismo bucket). */
  obtenerUrlFoto(nombreArchivo: string | null): string | null {
    return this.supabase.urlPublica(BUCKETS.clientes, nombreArchivo);
  }
  
  /**
   * Cliente registrado vinculado a un usuario de Supabase Auth. Es el
   * único lugar de la app que consulta clientes por su usuario de Auth
   * (login, redirección con sesión activa y clienteAprobadoGuard).
   */
  async obtenerPorAuthId(authUserId: string): Promise<ResultadoBusqueda<ClienteRow>> {
    const { data, error } = await this.supabase.client
      .from(TABLA_CLIENTES)
      .select('*')
      .eq('auth_customer_id', authUserId)
      .maybeSingle<ClienteRow>();

    if (error) {
      console.error('Error buscando cliente por usuario de Auth:', error);
      return { ok: false };
    }
    return { ok: true, dato: data };
  }

  /** Cliente registrado de la sesión actual, o null si no hay (o falla la consulta). */
  async obtenerClienteActual(): Promise<ClienteRow | null> {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return null;

    const resultado = await this.obtenerPorAuthId(userId);
    return resultado.ok ? resultado.dato : null;
  }

  async listarPendientes(): Promise<ClienteRow[]> {
    const { data, error } = await this.supabase.client
      .from(TABLA_CLIENTES)
      .select('*')
      .eq('estado', 'pendiente')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error listando clientes pendientes:', error);
      return [];
    }
    return (data ?? []) as ClienteRow[];
  }

  /** Devuelve la función que deja de escuchar. */
  observarClientes(alCambiar: () => void): () => void {
    const canal: RealtimeChannel = this.supabase.client
      .channel(`clientes-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: TABLA_CLIENTES }, () => alCambiar())
      .subscribe();

    const intervalo = setInterval(alCambiar, INTERVALO_RESPALDO_MS);

    return () => {
      clearInterval(intervalo);
      this.supabase.client.removeChannel(canal);
    };
  }

  async actualizarEstado(
    clienteId: string,
    estado: EstadoCliente,
    enEspera: EstadoEnEspera | null
  ): Promise<ResultadoAltaCliente> {
    const { error } = await this.supabase.client
      .from(TABLA_CLIENTES)
      .update({ estado, en_espera: enEspera })
      .eq('id', clienteId);

    if (error) {
      console.error('Error actualizando estado de cliente:', error);
      return { ok: false, mensaje: 'No se pudo actualizar el cliente.' };
    }
    return { ok: true };
  }

  async enviarEmailResultado(destinatario: string, nombre: string, aprobado: boolean): Promise<void> {
    const asunto = aprobado ? 'Tu registro fue aprobado' : 'Sobre tu registro';
    const html = aprobado ? plantillaClienteAprobado(nombre) : plantillaClienteRechazado(nombre);

    const { error } = await this.supabase.client.functions.invoke('enviar-email', {
      body: { destinatario, asunto, html },
    });

    if (error) {
      console.error('Error enviando email de resultado de registro:', error);
    }
  }

  async crearClienteRegistrado(
    datos: NuevoClienteRegistrado & { password: string },
    fotoDataUrl: string
  ): Promise<ResultadoAltaCliente> {
    try {
      const correo = datos.email.trim().toLowerCase();

      const { data, error } = await this.supabase.client.functions.invoke('crear-cliente', {
        body: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          dni: datos.dni,
          email: correo,
          password: datos.password,
          fotoDataUrl,
        },
      });

      if (error) {
        console.error('Error invocando crear-cliente:', error);
        return { ok: false, mensaje: 'No se pudo registrar el cliente. Probá de nuevo.' };
      }

      if (!data?.ok) {
        return { ok: false, mensaje: data?.error?.message ?? 'No se pudo registrar el cliente.' };
      }

      return { ok: true };
    } catch (error: unknown) {
      console.error('Error registrando cliente:', error);
      return {
        ok: false,
        mensaje: error instanceof Error ? error.message : 'Error inesperado al registrar el cliente.',
      };
    }
  }
}