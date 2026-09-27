import { Injectable, computed, signal } from '@angular/core';
import {
  CANTIDAD_MAXIMA_ITEM,
  ItemCarrito,
  LineaCarrito,
  calcularTiempoEstimado,
  calcularTotal,
} from '../models/pedido.model';
import { Producto } from '../models/producto.model';

/**
 * El pedido que el cliente está armando, antes de enviarlo: por cada
 * producto, cuántos quiere. Vive solo en memoria.
 *
 * Es un servicio (y no un signal de la pantalla) porque lo comparten la
 * carta en modo pedido (punto 12, issue 03), la barra del total (04) y el
 * resumen (05), y porque el punto 13 lo precarga con los ítems de un
 * pedido rechazado. Se vacía al enviar el pedido.
 *
 * Guarda una copia del Producto (con el precio y la demora del momento en
 * que se agregó), así el total y el tiempo estimado se calculan acá y
 * ninguna pantalla tiene que cruzar el carrito con la carta. Son una vista
 * previa: al enviar, PedidosService.crear() guarda el precio vigente de la
 * carta (y la base, con RLS, no acepta otro).
 */
@Injectable({ providedIn: 'root' })
export class CarritoService {
  /** Id del producto → producto y cantidad. Nunca guarda cantidades en 0. */
  private readonly estado = signal<ReadonlyMap<string, ItemCarrito>>(new Map());

  readonly items = computed<ItemCarrito[]>(() => [...this.estado().values()]);

  /** Lo que recibe PedidosService.crear(): solo el id y la cantidad. */
  readonly lineas = computed<LineaCarrito[]>(() =>
    this.items().map(({ producto, cantidad }) => ({ menuId: producto.id, cantidad }))
  );

  readonly vacio = computed<boolean>(() => this.estado().size === 0);

  readonly total = computed<number>(() =>
    calcularTotal(this.items().map(({ producto, cantidad }) => ({ precioUnitario: producto.precio, cantidad })))
  );

  /** Demora del producto más lento; 0 con el carrito vacío (se muestra «—»). */
  readonly tiempoEstimado = computed<number>(() =>
    calcularTiempoEstimado(this.items().map(({ producto }) => producto.demoraMin))
  );

  readonly cantidadProductos = computed<number>(() =>
    this.items().reduce((suma, { cantidad }) => suma + cantidad, 0)
  );

  cantidad(menuId: string): number {
    return this.estado().get(menuId)?.cantidad ?? 0;
  }

  /** Fija la cantidad de un producto, entre 0 y el máximo. En 0 lo quita. */
  cambiarCantidad(producto: Producto, cantidad: number): void {
    const acotada = Math.min(Math.max(Math.trunc(cantidad), 0), CANTIDAD_MAXIMA_ITEM);
    const nuevo = new Map(this.estado());
    if (acotada === 0) {
      nuevo.delete(producto.id);
    } else {
      nuevo.set(producto.id, { producto, cantidad: acotada });
    }
    this.estado.set(nuevo);
  }

  /** Reemplaza el carrito completo (punto 13: editar un pedido rechazado). */
  cargar(items: ItemCarrito[]): void {
    this.vaciar();
    for (const item of items) {
      this.cambiarCantidad(item.producto, item.cantidad);
    }
  }

  vaciar(): void {
    this.estado.set(new Map());
  }
}
