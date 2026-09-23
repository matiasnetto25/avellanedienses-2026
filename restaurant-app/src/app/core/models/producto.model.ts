export type CategoriaProducto = 'bebida' | 'comida' | 'postre';
 
export interface Producto {
  id: string;
  nombre: string;
  precio: number;
  descripcion: string;
  /** Texto libre, ej: "10-15 min" */
  tiempoElaboracion: string;
  categoria: CategoriaProducto;
  /**
   * Debe tener exactamente 3 elementos.
   * En testing pueden ser emojis (string), en producción URLs de Supabase Storage.
   */
  imagenes: [string, string, string];
}