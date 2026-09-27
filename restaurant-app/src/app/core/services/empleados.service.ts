import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BUCKETS } from '../storage-buckets';
import { NuevoEmpleado } from '../models/empleado.model';

export interface ResultadoAlta {
  ok: boolean;
  mensaje?: string;
}

/** Si Storage no responde en este tiempo, el alta se corta con un aviso. */
const TIEMPO_LIMITE_FOTO_MS = 30000;

/** Datos del formulario de alta (la foto va aparte, como data URL). */
export type DatosAltaEmpleado = Omit<NuevoEmpleado, 'foto' | 'estado'> & { password: string };

export interface ResultadoUsuarioAuth {
  ok: boolean;
  mensaje?: string;
  userId?: string;
}

@Injectable({ providedIn: 'root' })
export class EmpleadosService {
  private readonly supabase = inject(SupabaseService);

  async existeCuil(cuil: string): Promise<boolean> {
    const { data, error } = await this.supabase.client
      .from('empleados')
      .select('id')
      .eq('cuil', cuil)
      .maybeSingle();

    if (error) {
      console.error('Error consultando CUIL existente:', error);
      return false;
    }

    return !!data;
  }

  async existeEmail(email: string): Promise<boolean> {
    const correo = email.trim().toLowerCase();

    const { data, error } = await this.supabase.client
      .from('empleados')
      .select('id')
      .eq('email', correo)
      .maybeSingle();

    if (error) {
      console.error('Error consultando email existente:', error);
      return false;
    }

    return !!data;
  }

  private async crearUsuarioAuth(email: string, password: string): Promise<ResultadoUsuarioAuth> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke('crear-usuario-auth', {
        body: { email, password },
      });

      if (error) {
  return {
    ok: false,
    mensaje: `Error Auth: ${error.message}`,
  };
}

      if (!data?.ok || !data?.userId) {
        const detalle: string = data?.error?.message ?? data?.mensaje ?? '';
        // Auth ya tiene un usuario con ese email, pero no hay fila en
        // empleados (se verificó antes): quedó de un alta que falló a medias.
        if (/already (been )?registered/i.test(detalle)) {
          return {
            ok: false,
            mensaje:
              'Ese email ya tiene un usuario creado de un alta anterior que no terminó. ' +
              'Pedí que lo borren en Supabase (Authentication → Users) o usá otro email.',
          };
        }
        return { ok: false, mensaje: detalle || 'No se pudo crear el usuario.' };
      }

      return { ok: true, userId: data.userId };
    } catch (error: unknown) {
      console.error('Error creando usuario auth:', error);
      return {
        ok: false,
        mensaje:
          error instanceof Error
            ? error.message
            : 'Error inesperado al crear el usuario.',
      };
    }
  }

  obtenerUrlFoto(nombreArchivo: string | null): string | null {
    return this.supabase.urlPublica(BUCKETS.empleados, nombreArchivo);
  }

  /**
   * Alta completa de un empleado, en tres pasos:
   *  1) Sube la foto al bucket de empleados.
   *  2) Crea su usuario en Supabase Auth (Edge Function crear-usuario-auth).
   *  3) Inserta la fila en empleados, en estado 'On' y vinculada al usuario.
   *
   * Las validaciones de la pantalla (formulario, foto, puesto permitido,
   * CUIL o email duplicado) se hacen ANTES de llamar a este método.
   *
   * El orden importa: el usuario de Auth no se puede borrar desde la app,
   * así que se crea recién cuando la foto ya está subida. Si la subida
   * falla (por ejemplo, un error del servidor de Storage), no queda un
   * usuario huérfano que bloquee los reintentos con ese email.
   *
   * La foto se nombra <cuil>-<timestamp>.jpg: el bucket no permite pisar
   * ni borrar archivos, así que un nombre único evita chocar con la foto
   * que haya quedado de un intento anterior.
   *
   * Limitación que queda: si falla el paso 3, el usuario de Auth ya quedó
   * creado y huérfano. Deshacerlo requiere una Edge Function con permisos
   * de administrador.
   */
  async crearEmpleado(datos: DatosAltaEmpleado, fotoDataUrl: string): Promise<ResultadoAlta> {
    const correo = datos.email.trim().toLowerCase();

    const nombreArchivo = `${datos.cuil}-${Date.now()}.jpg`;
    const subida = await this.subirFoto(nombreArchivo, fotoDataUrl);
    if (!subida.ok) {
      return subida;
    }

    const resultadoAuth = await this.crearUsuarioAuth(correo, datos.password);
    if (!resultadoAuth.ok || !resultadoAuth.userId) {
      return { ok: false, mensaje: resultadoAuth.mensaje ?? 'No se pudo crear el usuario.' };
    }

    const { error: insertError } = await this.supabase.client.from('empleados').insert({
      auth_user_id: resultadoAuth.userId,
      estado: 'On',
      nombre: datos.nombre,
      apellido: datos.apellido,
      sexo: datos.sexo,
      fecha_nacimiento: datos.fecha_nacimiento,
      cuil: datos.cuil,
      email: correo,
      puesto: datos.puesto,
      foto: nombreArchivo,
    });
    if (insertError) {
      return { ok: false, mensaje: `Error al guardar el empleado: ${insertError.message}` };
    }

    return { ok: true };
  }

  /**
   * Sube la foto con un tiempo límite: si Storage no responde, el alta
   * falla con un aviso en lugar de dejar el spinner girando minutos.
   */
  private async subirFoto(nombreArchivo: string, fotoDataUrl: string): Promise<ResultadoAlta> {
    try {
      const fotoBlob = await (await fetch(fotoDataUrl)).blob();
      const subida = this.supabase.client.storage
        .from(BUCKETS.empleados)
        .upload(nombreArchivo, fotoBlob, { contentType: 'image/jpeg', upsert: false });
      const limite = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIEMPO_LIMITE_FOTO_MS));

      const resultado = await Promise.race([subida, limite]);
      if (resultado === 'timeout') {
        return { ok: false, mensaje: 'La foto tardó demasiado en subirse. Revisá la conexión y probá de nuevo.' };
      }
      if (resultado.error) {
        console.error('Error subiendo la foto del empleado:', resultado.error);
        return { ok: false, mensaje: 'No se pudo subir la foto del empleado. Probá de nuevo.' };
      }
      return { ok: true };
    } catch (error: unknown) {
      console.error('Error subiendo la foto del empleado:', error);
      return { ok: false, mensaje: 'No se pudo subir la foto del empleado. Probá de nuevo.' };
    }
  }
}
