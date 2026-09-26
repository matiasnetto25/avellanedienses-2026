import { Injectable, inject } from '@angular/core';
import { ClienteAnonimoService } from './cliente-anonimo.service';
import { ClientesService } from './clientes.service';

/**
 * Responde "¿quién es el cliente que está usando este dispositivo?",
 * sin importar si es anónimo o registrado. Las pantallas que trabajan con
 * "el cliente actual" (mesa, consultas al mozo, pedido) deben usar este
 * servicio en vez de leer Preferences o la sesión de Auth por su cuenta.
 *
 * Orden de resolución:
 *  1) Cliente anónimo: id guardado en el dispositivo (Capacitor Preferences),
 *     confirmando que la fila siga existiendo.
 *  2) Cliente registrado: sesión de Supabase Auth con estado "aprobado".
 */
@Injectable({ providedIn: 'root' })
export class ClienteActualService {
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly clientes = inject(ClientesService);

  async obtenerClienteIdActual(): Promise<string | null> {
    const anonimo = await this.clienteAnonimo.obtenerClienteActual();
    if (anonimo) return anonimo.id;

    const registrado = await this.clientes.obtenerClienteActual();
    if (registrado?.estado === 'aprobado') return registrado.id;

    return null;
  }

  /** Ruta de la pantalla principal que le corresponde al cliente actual. */
  async rutaInicioCliente(): Promise<string> {
    const anonimo = await this.clienteAnonimo.obtenerClienteActual();
    return anonimo ? '/cliente-anonimo' : '/cliente';
  }
}
