import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { formatearMinutos } from '../utils/minutos';
import { BUCKETS } from '../storage-buckets';
import { NuevoMenuItem, MenuItemRow, TipoMenuItem } from '../models/menu-item.model';
import { Producto } from '../models/producto.model';

const TABLA_MENU = 'menu';

export type CampoFotoMenu = 'principal' | 'cerca' | 'contexto';
const COLUMNA_FOTO: Record<CampoFotoMenu, 'foto_principal' | 'foto_cerca' | 'foto_contexto'> = {
  principal: 'foto_principal',
  cerca: 'foto_cerca',
  contexto: 'foto_contexto',
};

export interface CambiosMenuItem {
  /** Solo se manda para los platos (comida/postre): las bebidas siempre son 'bebida'. */
  tipo?: TipoMenuItem;
  nombre: string;
  descripcion: string;
  demora: number;
  precio: number;
}

export interface ResultadoAltaMenuItem {
  ok: boolean;
  mensaje?: string;
}

@Injectable({ providedIn: 'root' })
export class MenuItemsService {
  private readonly supabase = inject(SupabaseService);

  /** Sube con cada alta: las listas de productos la usan para refrescarse. */
  readonly altas = signal(0);


  /** Productos activos de la carta, por nombre. null si falló la consulta. */
  async listarActivos(): Promise<Producto[] | null> {
    const { data, error } = await this.supabase.client
      .from(TABLA_MENU)
      .select('*')
      .eq('estado', 'On')
      .order('nombre', { ascending: true });

    if (error) {
      console.error('Error listando productos del menú:', error);
      return null;
    }

    return (data as MenuItemRow[]).map((fila) => this.mapearAProducto(fila));
  }

  private mapearAProducto(fila: MenuItemRow): Producto {
    return {
      id: fila.id,
      nombre: fila.nombre,
      precio: fila.precio,
      descripcion: fila.descripcion ?? '',
      tiempoElaboracion: fila.demora != null ? formatearMinutos(fila.demora) : '',
      demoraMin: fila.demora ?? 0,
      categoria: fila.tipo,
      imagenes: [
        this.obtenerUrl(fila.foto_principal) ?? '',
        this.obtenerUrl(fila.foto_cerca) ?? '',
        this.obtenerUrl(fila.foto_contexto) ?? '',
      ],
    };
  }


  /**
   * ¿Ya hay un producto ACTIVO con ese nombre y tipo? Los dados de baja no
   * cuentan (se puede volver a cargar uno eliminado). `excluirId` sirve al
   * editar, para que un producto no choque consigo mismo.
   */
  async existeNombreTipo(nombre: string, tipo: string, excluirId?: string): Promise<boolean> {
    const nombreTrim = nombre.trim();

    let consulta = this.supabase.client
      .from(TABLA_MENU)
      .select('id')
      .eq('tipo', tipo)
      .eq('estado', 'On')
      .ilike('nombre', nombreTrim)
      .limit(1);

    if (excluirId) consulta = consulta.neq('id', excluirId);

    const { data, error } = await consulta;

    if (error) {
      console.error('Error consultando duplicado en menu:', error);
      return false;
    }
    return (data?.length ?? 0) > 0;
  }

  obtenerUrl(path: string | null): string | null {
    return this.supabase.urlPublica(BUCKETS.menu, path);
  }

  private async subirImagen(path: string, dataUrl: string): Promise<void> {
    const base64 = dataUrl.split(',')[1];
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

    const { error } = await this.supabase.client.storage
      .from(BUCKETS.menu)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });

    if (error) {
      throw new Error(`No se pudo subir la imagen: ${error.message}`);
    }
  }

  private async eliminarImagenes(paths: string[]): Promise<void> {
    if (!paths.length) return;
    const { error } = await this.supabase.client.storage.from(BUCKETS.menu).remove(paths);
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

    this.altas.update((n) => n + 1);
    return { ok: true };
  }

  /**
   * Modifica un producto. Las fotos nuevas se suben con un nombre único
   * (no pisan a las anteriores, que se borran recién cuando el cambio
   * quedó guardado), así un error a mitad de camino no deja el producto
   * sin imagen.
   */
  async actualizarItem(
    id: string,
    cambios: CambiosMenuItem,
    fotosNuevas: Partial<Record<CampoFotoMenu, string>> = {}
  ): Promise<ResultadoAltaMenuItem> {
    const { data: actual, error: errorLectura } = await this.supabase.client
      .from(TABLA_MENU)
      .select('foto_principal, foto_cerca, foto_contexto')
      .eq('id', id)
      .maybeSingle();

    if (errorLectura || !actual) {
      console.error('Error leyendo el producto a modificar:', errorLectura);
      return { ok: false, mensaje: 'No se encontró el producto.' };
    }

    const fila: Record<string, unknown> = {
      nombre: cambios.nombre.trim(),
      descripcion: cambios.descripcion.trim(),
      demora: cambios.demora,
      precio: cambios.precio,
    };
    if (cambios.tipo) fila['tipo'] = cambios.tipo;

    const subidas: string[] = [];
    const anteriores: string[] = [];
    const marca = Date.now();

    try {
      for (const campo of Object.keys(COLUMNA_FOTO) as CampoFotoMenu[]) {
        const dataUrl = fotosNuevas[campo];
        if (!dataUrl) continue;

        const path = `${id}/${campo}-${marca}.jpg`;
        await this.subirImagen(path, dataUrl);
        subidas.push(path);

        const columna = COLUMNA_FOTO[campo];
        const anterior = (actual as Record<string, string | null>)[columna];
        if (anterior) anteriores.push(anterior);
        fila[columna] = path;
      }
    } catch (error: unknown) {
      await this.eliminarImagenes(subidas);
      const mensaje = error instanceof Error ? error.message : 'No se pudieron subir las imágenes.';
      return { ok: false, mensaje };
    }

    // .select() devuelve las filas modificadas: vacío = la política RLS no lo permitió.
    const { data: filas, error } = await this.supabase.client
      .from(TABLA_MENU)
      .update(fila)
      .eq('id', id)
      .select('id');

    if (error || !filas?.length) {
      console.error('Error actualizando item de menú:', error);
      await this.eliminarImagenes(subidas);
      return {
        ok: false,
        mensaje: error
          ? 'No se pudo guardar los cambios. Probá de nuevo.'
          : 'No tenés permiso para modificar este producto.',
      };
    }

    await this.eliminarImagenes(anteriores);
    this.altas.update((n) => n + 1);
    return { ok: true };
  }

  /**
   * «Eliminar» = dar de baja (estado 'Off'): el producto deja de verse en la
   * carta y en las listas, pero sigue existiendo porque los pedidos ya
   * hechos lo referencian (pedido_items.menu_id, sin cascade).
   */
  async darDeBaja(id: string): Promise<ResultadoAltaMenuItem> {
    const { data: filas, error } = await this.supabase.client
      .from(TABLA_MENU)
      .update({ estado: 'Off' })
      .eq('id', id)
      .select('id');

    if (error || !filas?.length) {
      console.error('Error dando de baja el item de menú:', error);
      return {
        ok: false,
        mensaje: error ? 'No se pudo eliminar el producto.' : 'No tenés permiso para eliminar este producto.',
      };
    }

    this.altas.update((n) => n + 1);
    return { ok: true };
  }
}