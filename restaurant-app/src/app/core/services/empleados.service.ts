import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { NuevoEmpleado } from '../models/empleado.model';

export interface ResultadoAlta {
  ok: boolean;
  mensaje?: string;
}

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

  async crearUsuarioAuth(email: string, password: string): Promise<ResultadoUsuarioAuth> {
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
  return {
    ok: false,
    mensaje:
      data?.error?.message ??
      data?.mensaje ??
      'No se pudo crear el usuario.',
  };
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
  if (!nombreArchivo) {
    return null;
  }

  const { data } = this.supabase.client.storage
    .from('empleado')
    .getPublicUrl(nombreArchivo);

  return data.publicUrl;
}

  async crearEmpleado(
    datos: Omit<NuevoEmpleado, 'foto' | 'estado' | 'auth_user_id'> & {
      password: string;
    },
    fotoDataUrl: string
  ): Promise<ResultadoAlta> {
    try {
      const correo = datos.email.trim().toLowerCase();

      const { data, error } =
        await this.supabase.client.functions.invoke('crear-empleado', {
          body: {
            nombre: datos.nombre,
            apellido: datos.apellido,
            sexo: datos.sexo,
            fecha_nacimiento: datos.fecha_nacimiento,
            cuil: datos.cuil,
            email: correo,
            password: datos.password,
            puesto: datos.puesto,
            fotoDataUrl,
          },
        });

      if (error) {
        console.error('Error invocando Edge Function:', error);

        return {
          ok: false,
          mensaje: 'No se pudo crear el empleado. Probá de nuevo.',
        };
      }

      if (!data?.ok) {
        return {
          ok: false,
          mensaje: data?.mensaje ?? 'No se pudo crear el empleado.',
        };
      }

      return { ok: true };
    } catch (error: unknown) {
      console.error('Error creando empleado:', error);

      return {
        ok: false,
        mensaje:
          error instanceof Error
            ? error.message
            : 'Error inesperado al crear el empleado.',
      };
    }
  }
}

