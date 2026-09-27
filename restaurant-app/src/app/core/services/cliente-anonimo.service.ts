import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import { SupabaseService } from './supabase.service';
import { NotificacionesService } from './notificaciones.service';
import { ClientesService } from './clientes.service';
import { ResultadoOperacion } from '../models/resultado-operacion';

const CLAVE_CLIENTE_ANONIMO_ID = 'merlot_cliente_anonimo_id';

export interface ClienteAnonimoActual {
  id: string;
  nombre: string;
  fotoUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class ClienteAnonimoService {
  private readonly supabase = inject(SupabaseService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly clientes = inject(ClientesService);

  // ===== Identidad persistida en el dispositivo =====

  async obtenerIdGuardado(): Promise<string | null> {
    const { value } = await Preferences.get({ key: CLAVE_CLIENTE_ANONIMO_ID });
    return value ?? null;
  }

  private async guardarId(clienteId: string): Promise<void> {
    await Preferences.set({ key: CLAVE_CLIENTE_ANONIMO_ID, value: clienteId });
  }

  /**
   * Si hay un id guardado, confirma que la fila todavía exista en
   * "clientes" (por si se borró a mano) y devuelve sus datos. Si no hay
   * id guardado, o la fila ya no existe, devuelve null — el caller debe
   * mostrar el formulario de alta.
   */
  async obtenerClienteActual(): Promise<ClienteAnonimoActual | null> {
    const id = await this.obtenerIdGuardado();
    if (!id) return null;

    const { data, error } = await this.supabase.client
      .from('clientes')
      .select('id, nombre, foto')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      nombre: data.nombre,
      fotoUrl: this.clientes.obtenerUrlFoto(data.foto),
    };
  }

  /**
   * Alta de cliente anónimo (nombre + foto, sin usuario de Auth). Guarda
   * el id resultante en el dispositivo para no volver a pedir el alta.
   */
  async registrarAnonimo(nombre: string, apellido: string, fotoDataUrl: string): Promise<ResultadoOperacion & { clienteId?: string }> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke('crear-cliente-anonimo', {
        body: { nombre, apellido, fotoDataUrl },
      });

      if (error) {
        console.error('Error invocando crear-cliente-anonimo:', error);
        return { ok: false, mensaje: 'No se pudo registrar. Probá de nuevo.' };
      }
      if (!data?.ok) {
        return { ok: false, mensaje: data?.error?.message ?? 'No se pudo registrar.' };
      }

      await this.guardarId(data.clienteId);
      await this.registrarPushToken(data.clienteId);
      return { ok: true, clienteId: data.clienteId };
    } catch (error: unknown) {
      console.error('Error registrando cliente anónimo:', error);
      return { ok: false, mensaje: 'Error inesperado al registrar.' };
    }
  }

  /**
   * Asocia el token de push del dispositivo (ya obtenido por
   * NotificacionesService al arrancar la app) con este cliente anónimo.
   * Se llama tanto al registrarse por primera vez, como cada vez que
   * vuelve a abrir la app con un id ya guardado (por si el token cambió).
   */
  async registrarPushToken(clienteId: string): Promise<void> {
    const token = this.notificaciones.obtenerTokenActual();
    if (!token) return;

    const { error } = await this.supabase.client.rpc('registrar_push_token_cliente', {
      p_cliente_id: clienteId,
      p_token: token,
    });

    if (error) {
      console.error('Error registrando push token de cliente anónimo:', error);
    }
  }

  // ===== Cierre de sesión / baja de cuenta =====

  /**
   * Borra por completo al cliente anónimo: su fila en "clientes", su
   * foto en Storage, su token de push, y su solicitud de mesa (si tenía
   * una mesa ACEPTADA pero no vinculada, la libera de paso).
   *
   * Se hace vía Edge Function (permisos de admin) y no directo desde
   * acá: el cliente público no tiene permiso de borrado en el bucket
   * de Storage, así que si se intentaba borrar la foto desde el
   * frontend, fallaba en silencio y quedaba huérfana.
   *
   * Si ya está VINCULADO a una mesa, no borra nada — devuelve
   * bloqueado:true para que el caller le muestre el cartel de acercarse
   * al mostrador en vez de dejarlo cerrar sesión.
   */
  async eliminarCuenta(clienteId: string): Promise<
    ResultadoOperacion & { bloqueado?: boolean; numeroMesa?: number; mesaLiberada?: number | null }
  > {
    try {
      const { data, error } = await this.supabase.client.functions.invoke('eliminar-cliente-anonimo', {
        body: { clienteId },
      });

      if (error) {
        console.error('Error invocando eliminar-cliente-anonimo:', error);
        return { ok: false, mensaje: 'No se pudo cerrar la sesión.' };
      }

      const resultado = data as {
        ok: boolean;
        bloqueado?: boolean;
        numero_mesa?: number;
        mensaje?: string;
        mesa_liberada?: number | null;
      };

      if (!resultado.ok) {
        return { ok: false, bloqueado: resultado.bloqueado, numeroMesa: resultado.numero_mesa, mensaje: resultado.mensaje };
      }

      await Preferences.remove({ key: CLAVE_CLIENTE_ANONIMO_ID });

      return { ok: true, mesaLiberada: resultado.mesa_liberada ?? null };
    } catch (error: unknown) {
      console.error('Error eliminando cliente anónimo:', error);
      return { ok: false, mensaje: 'Error inesperado al cerrar sesión.' };
    }
  }
}