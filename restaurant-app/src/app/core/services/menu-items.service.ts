import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { NuevoMenuItem, MenuItemRow } from '../models/menu-item.model';
import { Producto } from '../models/producto.model';

const BUCKET_MENU = 'menu';
const TABLA_MENU = 'menu';

export interface ResultadoAltaMenuItem {
  ok: boolean;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class MenuItemsService {
  private readonly supabase = inject(SupabaseService);


  async listarActivos(): Promise<Producto[]> {
    const { data, error } = await this.supabase.client
      .from(TABLA_MENU)
      .select('*')
      .eq('estado', 'On')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error listando productos del menú:', error);
      return [];
    }

    return (data as MenuItemRow[]).map((fila) => this.mapearAProducto(fila));
  }

  private mapearAProducto(fila: MenuItemRow): Producto {
    return {
      id: fila.id,
      nombre: fila.nombre,
      precio: fila.precio,
      descripcion: fila.descripcion ?? '',
      tiempoElaboracion: fila.demora != null ? `${fila.demora} min` : '',
      categoria: fila.tipo,
      imagenes: [
        this.obtenerUrl(fila.foto_principal) ?? '',
        this.obtenerUrl(fila.foto_cerca) ?? '',
        this.obtenerUrl(fila.foto_contexto) ?? '',
      ],
    };
  }


  async existeNombreTipo(nombre: string, tipo: string): Promise<boolean> {
    const nombreTrim = nombre.trim();

    const { data, error } = await this.supabase.client
      .from(TABLA_MENU)
      .select('id')
      .eq('tipo', tipo)
      .ilike('nombre', nombreTrim)
      .maybeSingle();

    if (error) {
      console.error('Error consultando duplicado en menu:', error);
      return false;
    }
    return !!data;
  }

  obtenerUrl(path: string | null): string | null {
    if (!path) return null;
    const { data } = this.supabase.client.storage.from(BUCKET_MENU).getPublicUrl(path);
    return data.publicUrl;
  }

  private async subirImagen(path: string, dataUrl: string): Promise<void> {
    const base64 = dataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { error } = await this.supabase.client.storage
      .from(BUCKET_MENU)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });

    if (error) {
      throw new Error(`No se pudo subir la imagen: ${error.message}`);
    }
  }

  private async eliminarImagenes(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.supabase.client.storage.from(BUCKET_MENU).remove(paths);
    if (error) {
      console.error('No se pudieron limpiar las imágenes subidas tras un error:', error);
    }
  }


  async crearItem(
    datos: Omit<NuevoMenuItem, 'foto_principal' | 'foto_cerca' | 'foto_contexto'>,
    fotos: { principal: string; cerca: string; contexto: string }
  ): Promise<ResultadoAltaMenuItem> {
    const id = crypto.randomUUID();
    const pathPrincipal = `${id}/principal.jpg`;
    const pathCerca = `${id}/cerca.jpg`;
    const pathContexto = `${id}/contexto.jpg`;

    try {
      await this.subirImagen(pathPrincipal, fotos.principal);
      await this.subirImagen(pathCerca, fotos.cerca);
      await this.subirImagen(pathContexto, fotos.contexto);
    } catch (error: unknown) {
      await this.eliminarImagenes([pathPrincipal, pathCerca, pathContexto]);
      const mensaje = error instanceof Error ? error.message : 'No se pudieron subir las imágenes.';
      return { ok: false, mensaje };
    }

    const { error } = await this.supabase.client.from(TABLA_MENU).insert({
      id,
      estado: 'On',
      tipo: datos.tipo,
      nombre: datos.nombre.trim(),
      descripcion: datos.descripcion?.trim() ?? null,
      demora: datos.demora,
      precio: datos.precio,
      foto_principal: pathPrincipal,
      foto_cerca: pathCerca,
      foto_contexto: pathContexto,
    });

    if (error) {
      console.error('Error insertando item de menú:', error);
      await this.eliminarImagenes([pathPrincipal, pathCerca, pathContexto]);
      return { ok: false, mensaje: 'No se pudo guardar el producto. Probá de nuevo.' };
    }

    return { ok: true };
  }
}