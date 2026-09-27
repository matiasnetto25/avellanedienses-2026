import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { BUCKETS, Bucket } from '../storage-buckets';
import { QrService } from './qr.service';
import { MesaRow, NuevaMesa } from '../models/mesa.model';

const TABLA_MESA = 'mesa';

export interface ResultadoOperacionMesa {
  ok: boolean;
  mensaje?: string;
  mesa?: MesaRow;
}

@Injectable({ providedIn: 'root' })
export class MesasService {
  private readonly supabase = inject(SupabaseService);
  private readonly qrService = inject(QrService);

  async listar(): Promise<MesaRow[]> {
    const { data, error } = await this.supabase.client
      .from(TABLA_MESA)
      .select('*')
      .order('numero_mesa', { ascending: true });

    if (error) {
      console.error('Error listando mesas:', error);
      return [];
    }
    return (data ?? []) as MesaRow[];
  }

  async obtenerPorId(id: string): Promise<MesaRow | null> {
    const { data, error } = await this.supabase.client
      .from(TABLA_MESA)
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error obteniendo mesa por id:', error);
      return null;
    }
    return data as MesaRow | null;
  }

  async existeNumero(numeroMesa: number, excluirId?: string): Promise<boolean> {
    let query = this.supabase.client
      .from(TABLA_MESA)
      .select('id')
      .eq('numero_mesa', numeroMesa);

    if (excluirId) {
      query = query.neq('id', excluirId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error('Error consultando número de mesa:', error);
      return false;
    }
    return !!data;
  }

  /** URL pública de la foto a partir del nombre de archivo guardado en Mesa.foto */
  obtenerUrlFoto(nombreArchivo: string | null): string | null {
    return this.supabase.urlPublica(BUCKETS.mesas, nombreArchivo);
  }

  /** URL pública del QR a partir del nombre de archivo guardado en Mesa.qr */
  obtenerUrlQr(nombreArchivo: string | null): string | null {
    return this.supabase.urlPublica(BUCKETS.qrMesas, nombreArchivo);
  }

  private async subirImagen(
    bucket: Bucket,
    nombreArchivo: string,
    dataUrl: string,
    contentType: string
  ): Promise<void> {
    const base64 = dataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { error } = await this.supabase.client.storage
      .from(bucket)
      .upload(nombreArchivo, bytes, { contentType, upsert: false });

    if (error) {
      throw new Error(`No se pudo subir el archivo (${bucket}): ${error.message}`);
    }
  }

  private async eliminarArchivo(bucket: Bucket, nombreArchivo: string | null): Promise<void> {
    if (!nombreArchivo) return;
    const { error } = await this.supabase.client.storage.from(bucket).remove([nombreArchivo]);
    if (error) {
      // No bloqueamos la operación principal por esto, solo queda logueado.
      console.error(`No se pudo eliminar el archivo anterior de ${bucket}:`, error);
    }
  }

  /**
   * Genera el QR de una mesa y lo sube al bucket "qr_mesa" con el MISMO
   * identificador que la foto (prefijo "qr-"), para que quede clara la
   * relación entre ambos archivos. Ej: foto = "abc123.jpg" -> qr = "qr-abc123.png"
   */
  private async generarYSubirQr(mesaId: string, identificador: string): Promise<string> {
    const urlMesa = `${window.location.origin}/mesa/${mesaId}`;
    const qrDataUrl = await this.qrService.generarDataUrl(urlMesa);
    const nombreQr = `qr-${identificador}.png`;
    await this.subirImagen(BUCKETS.qrMesas, nombreQr, qrDataUrl, 'image/png');
    return nombreQr;
  }

  async crearMesa(datos: Omit<NuevaMesa, 'foto' | 'qr'>, fotoDataUrl: string): Promise<ResultadoOperacionMesa> {
    try {
      const identificador = crypto.randomUUID();
      const nombreFoto = `${identificador}.jpg`;
      await this.subirImagen(BUCKETS.mesas, nombreFoto, fotoDataUrl, 'image/jpeg');

      const { data, error } = await this.supabase.client
        .from(TABLA_MESA)
        .insert({ ...datos, foto: nombreFoto, disponibilidad: 'Libre' })
        .select()
        .single();

      if (error) {
        console.error('❌ ERROR INSERTANDO MESA:', error);
        console.error('❌ code:', error.code);
        console.error('❌ message:', error.message);
        console.error('❌ details:', error.details);
        console.error('❌ hint:', error.hint);

        if (error.code === '23505') {
          return {
            ok: false,
            mensaje: 'El número de mesa ingresado ya existe. Elegí otro número.'
          };
        }

        return {
          ok: false,
          mensaje: `Error Supabase: ${error.message}`
        };
      }

      const mesa = data as MesaRow;

      // El QR necesita el id real de la mesa (recién asignado por Supabase),
      // por eso se genera y sube DESPUÉS del insert, en un segundo paso.
     try {
  const nombreQr = await this.generarYSubirQr(mesa.id, identificador);

  const { data: mesaConQr, error: errorQr } =
    await this.supabase.client
      .from(TABLA_MESA)
      .update({ qr: nombreQr })
      .eq('id', mesa.id)
      .select()
      .single();

  if (!errorQr && mesaConQr) {
    return {
      ok: true,
      mesa: mesaConQr as MesaRow
    };
  }

  throw new Error(
    `Código: ${errorQr?.code ?? 'sin código'} | ` +
    `Mensaje: ${errorQr?.message ?? 'sin mensaje'} | ` +
    `Detalle: ${errorQr?.details ?? 'sin detalle'} | ` +
    `Hint: ${errorQr?.hint ?? 'sin hint'}`
  );

} catch (errorQrGen: unknown) {
  const mensaje =
    errorQrGen instanceof Error
      ? errorQrGen.message
      : 'Error desconocido al generar o guardar el código QR.';

  throw new Error(mensaje);
}

      // La mesa quedó creada igual aunque el QR haya fallado; no se pierde el alta por esto.
      return { ok: true, mesa };
    } catch (error: unknown) {
      console.error('Error creando mesa:', error);
      const mensaje = error instanceof Error ? error.message : 'Error inesperado al crear la mesa.';
      return { ok: false, mensaje };
    }
  }

  async actualizarDisponibilidad(id: string, disponibilidad: MesaRow['disponibilidad']): Promise<ResultadoOperacionMesa> {
    const { error } = await this.supabase.client
      .from(TABLA_MESA)
      .update({ disponibilidad })
      .eq('id', id);

    if (error) {
      console.error('Error actualizando disponibilidad:', error);
      return { ok: false, mensaje: 'No se pudo actualizar la disponibilidad.' };
    }
    return { ok: true };
  }

  /**
   * Actualiza los datos de una mesa. El QR SOLO se regenera cuando se
   * reemplaza la foto (nuevaFotoDataUrl presente) — el contenido del QR
   * (la URL con el id de la mesa) no cambia si solo se edita el número,
   * la cantidad de comensales o el tipo, así que no tiene sentido tocarlo.
   */
  async actualizarMesa(
    mesaActual: MesaRow,
    cambios: { numero_mesa: number; cant_comensales: number; tipo: MesaRow['tipo'] },
    nuevaFotoDataUrl?: string
  ): Promise<ResultadoOperacionMesa> {
    try {
      const payload: Partial<MesaRow> = { ...cambios };
      let nuevoNombreFoto: string | null = null;
      let nuevoNombreQr: string | null = null;

      if (nuevaFotoDataUrl) {
        const identificador = crypto.randomUUID();
        nuevoNombreFoto = `${identificador}.jpg`;
        await this.subirImagen(BUCKETS.mesas, nuevoNombreFoto, nuevaFotoDataUrl, 'image/jpeg');

        nuevoNombreQr = await this.generarYSubirQr(mesaActual.id, identificador);

        payload.foto = nuevoNombreFoto;
        payload.qr = nuevoNombreQr;
      }

      const { data, error } = await this.supabase.client
        .from(TABLA_MESA)
        .update(payload)
        .eq('id', mesaActual.id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando mesa:', error);
        if (error.code === '23505') {
          return { ok: false, mensaje: 'El número de mesa ingresado ya existe. Elegí otro número.' };
        }
        return { ok: false, mensaje: 'No se pudo actualizar la mesa. Probá de nuevo.' };
      }

      // Se borran los archivos viejos SOLO después de confirmar que la
      // actualización de la fila salió bien (evita archivos huérfanos sin
      // arriesgar perder ambas versiones si algo falla a mitad de camino).
      if (nuevoNombreFoto && mesaActual.foto) {
        await this.eliminarArchivo(BUCKETS.mesas, mesaActual.foto);
      }
      if (nuevoNombreQr && mesaActual.qr) {
        await this.eliminarArchivo(BUCKETS.qrMesas, mesaActual.qr);
      }

      return { ok: true, mesa: data as MesaRow };
    } catch (error: unknown) {
      console.error('Error actualizando mesa:', error);
      const mensaje = error instanceof Error ? error.message : 'Error inesperado al actualizar la mesa.';
      return { ok: false, mensaje };
    }
  }

  async eliminarMesa(mesa: MesaRow): Promise<ResultadoOperacionMesa> {
    const { error } = await this.supabase.client.from(TABLA_MESA).delete().eq('id', mesa.id);

    if (error) {
      console.error('Error eliminando mesa:', error);
      return { ok: false, mensaje: 'No se pudo eliminar la mesa. Probá de nuevo.' };
    }

    await this.eliminarArchivo(BUCKETS.mesas, mesa.foto);
    await this.eliminarArchivo(BUCKETS.qrMesas, mesa.qr);

    return { ok: true };
  }
}
