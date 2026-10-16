import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BUCKETS } from '../storage-buckets';
import { EmpleadoRow, EmpleadoSesion, NuevoEmpleado, Puesto } from '../models/empleado.model';
import { ResultadoBusqueda } from '../models/resultado-busqueda';

export interface ResultadoAlta {
  ok: boolean;
  mensaje?: string;
}

/** Si Storage no responde en este tiempo, el alta se corta con un aviso. */
const TIEMPO_LIMITE_FOTO_MS = 30000;

/** Datos del formulario de alta (la foto va aparte, como data URL). */
export type DatosAltaEmpleado = Omit<NuevoEmpleado, 'foto' | 'estado'> & { password: string };

/** Lo que se puede modificar de un empleado desde la lista (CUIL, DNI y email no). */
export interface CambiosEmpleado {
  nombre: string;
  apellido: string;
  puesto: Puesto;
}

export interface ResultadoGestionEmpleado {
  ok: boolean;
  mensaje?: string;
  empleado?: EmpleadoRow;
}

export interface ResultadoUsuarioAuth {
  ok: boolean;
  mensaje?: string;
  userId?: string;
}

@Injectable({ providedIn: 'root' })
export class EmpleadosService {
  private readonly supabase = inject(SupabaseService);

  /** Sube cada vez que se da de alta un empleado: la lista de Personal se actualiza sola. */
  readonly version = signal(0);

  /**
   * Empleado vinculado a un usuario de Supabase Auth, listo para la
   * sesión: con la URL de la foto ya resuelta. No valida el estado ni el
   * puesto; eso lo deciden Auth (estado 'On') y puestoGuard (rutas).
   */
  async obtenerPorAuthId(authUserId: string): Promise<ResultadoBusqueda<EmpleadoSesion>> {
    const { data, error } = await this.supabase.client
      .from('empleados')
      .select('id, auth_user_id, estado, nombre, apellido, cuil, email, puesto, foto')
      .eq('auth_user_id', authUserId)
      .maybeSingle<EmpleadoRow>();

    if (error) {
      console.error('Error buscando empleado por usuario de Auth:', error);
      return { ok: false };
    }
    if (!data) {
      return { ok: true, dato: null };
    }

    return {
      ok: true,
      dato: {
        id: data.id,
        nombre: data.nombre,
        apellido: data.apellido,
        email: data.email,
        puesto: data.puesto,
        estado: data.estado,
        // La tabla guarda solo el nombre del archivo ("20-35371754-6.jpg").
        foto: this.obtenerUrlFoto(data.foto),
      },
    };
  }

  /** Todos los empleados, ordenados por apellido y nombre (lista de Personal). */
  async listar(): Promise<EmpleadoRow[]> {
    const { data, error } = await this.supabase.client
      .from('empleados')
      .select('id, auth_user_id, estado, nombre, apellido, cuil, email, puesto, foto')
      .order('apellido', { ascending: true })
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error listando empleados:', error);
      return [];
    }
    return (data ?? []) as EmpleadoRow[];
  }

  /**
   * Guarda los cambios de un empleado. Si hay foto nueva, se sube primero
   * (con nombre único, el bucket no permite pisar archivos) y la Edge
   * Function la asigna y borra la anterior. Los permisos los valida el
   * servidor.
   */
  async actualizarEmpleado(
    empleado: EmpleadoRow,
    cambios: CambiosEmpleado,
    nuevaFotoDataUrl?: string
  ): Promise<ResultadoGestionEmpleado> {
    let nombreFoto: string | undefined;
    if (nuevaFotoDataUrl) {
      nombreFoto = `${empleado.cuil}-${Date.now()}.jpg`;
      const subida = await this.subirFoto(nombreFoto, nuevaFotoDataUrl);
      if (!subida.ok) return subida;
    }

    return this.invocarGestion({
      accion: 'actualizar',
      empleadoId: empleado.id,
      cambios: { ...cambios, ...(nombreFoto ? { foto: nombreFoto } : {}) },
    });
  }

  /** Elimina al empleado, su usuario de Auth y su foto (todo en la Edge Function). */
  async eliminarEmpleado(empleado: EmpleadoRow): Promise<ResultadoGestionEmpleado> {
    return this.invocarGestion({ accion: 'eliminar', empleadoId: empleado.id });
  }

  private async invocarGestion(body: Record<string, unknown>): Promise<ResultadoGestionEmpleado> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke('gestionar-empleado', { body });
      if (error) {
        // FunctionsHttpError trae la Response en error.context: de ahí sale el status real.
        const respuesta = (error as { context?: Response }).context;
        const status = respuesta?.status;
        let detalle = '';
        try {
          detalle = respuesta ? await respuesta.clone().text() : '';
        } catch {
          /* sin detalle */
        }
        console.error('Error invocando gestionar-empleado ->', 'status:', status, '| detalle:', detalle, '|', error);

        if (status === 404) {
          return { ok: false, mensaje: 'La función "gestionar-empleado" no está publicada en Supabase. Hay que desplegarla.' };
        }
        if (status === 401 || status === 403) {
          return { ok: false, mensaje: 'La sesión no es válida. Cerrá sesión y volvé a ingresar.' };
        }
        if (status && status >= 500) {
          return { ok: false, mensaje: 'La función "gestionar-empleado" falló en el servidor. Revisá sus logs en Supabase.' };
        }
        return { ok: false, mensaje: 'No se pudo completar la operación. Revisá la conexión y probá de nuevo.' };
      }
      if (!data?.ok) {
        return { ok: false, mensaje: data?.error?.message ?? 'No se pudo completar la operación.' };
      }
      return { ok: true, empleado: data.empleado as EmpleadoRow | undefined };
    } catch (error: unknown) {
      console.error('Error gestionando empleado:', error);
      return { ok: false, mensaje: 'No se pudo completar la operación. Probá de nuevo.' };
    }
  }

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
      cuil: datos.cuil,
      email: correo,
      puesto: datos.puesto,
      foto: nombreArchivo,
    });
    if (insertError) {
      return { ok: false, mensaje: `Error al guardar el empleado: ${insertError.message}` };
    }

    this.version.update((v) => v + 1);
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