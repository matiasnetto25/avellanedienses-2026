import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { ClienteRow, EstadoCliente, EstadoEnEspera, NuevoClienteRegistrado } from '../models/cliente.model';
import { plantillaClienteAprobado, plantillaClienteRechazado } from '../emails/email-templates';

const TABLA_CLIENTES = 'clientes';
const BUCKET_CLIENTES = 'cliente';

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

  obtenerUrlFoto(nombreArchivo: string | null): string | null {
    if (!nombreArchivo) return null;
    const { data } = this.supabase.client.storage.from(BUCKET_CLIENTES).getPublicUrl(nombreArchivo);
    return data.publicUrl;
  }
  
  async obtenerClienteActual(): Promise<ClienteRow | null> {
    const { data: sessionData } = await this.supabase.client.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return null;

    const { data, error } = await this.supabase.client
      .from(TABLA_CLIENTES)
      .select('*')
      .eq('auth_customer_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error obteniendo cliente actual:', error);
      return null;
    }
    return data as ClienteRow | null;
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