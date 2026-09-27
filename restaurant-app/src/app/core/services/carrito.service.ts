import { Injectable, computed, signal } from '@angular/core';
import { CANTIDAD_MAXIMA_ITEM, LineaCarrito } from '../models/pedido.model';

/**
 * El pedido que el cliente está armando, antes de enviarlo: por cada
 * producto, cuántos quiere. Vive solo en memoria.
 *
 * Es un servicio (y no un signal de la pantalla) porque lo comparten la
 * carta en modo pedido (punto 12, issue 03), la barra del total (04) y el
 * resumen (05), y porque el punto 13 lo precarga con los ítems de un
 * pedido rechazado. Se vacía al enviar el pedido.
 */
@Injectable({ providedIn: 'root' })
export class CarritoService {
  /** Id del producto → cantidad. Nunca guarda cantidades en 0. */
  private readonly cantidades = signal<ReadonlyMap<string, number>>(new Map());

  readonly lineas = computed<LineaCarrito[]>(() =>
    [...this.cantidades()].map(([menuId, cantidad]) => ({ menuId, cantidad }))
  );

  readonly vacio = computed(() => this.cantidades().size === 0);

  cantidad(menuId: string): number {
    return this.cantidades().get(menuId) ?? 0;
  }

  /** Fija la cantidad de un producto, entre 0 y el máximo. En 0 lo quita. */
  cambiarCantidad(menuId: string, cantidad: number): void {
    const acotada = Math.min(Math.max(Math.trunc(cantidad), 0), CANTIDAD_MAXIMA_ITEM);
    const nuevas = new Map(this.cantidades());
    if (acotada === 0) {
      nuevas.delete(menuId);
    } else {
      nuevas.set(menuId, acotada);
    }
    this.cantidades.set(nuevas);
  }

  /** Reemplaza el carrito completo (punto 13: editar un pedido rechazado). */
  cargar(lineas: LineaCarrito[]): void {
    this.vaciar();
    for (const linea of lineas) {
      this.cambiarCantidad(linea.menuId, linea.cantidad);
    }
  }

  vaciar(): void {
    this.cantidades.set(new Map());
  }
}
