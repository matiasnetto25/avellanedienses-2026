export type EstadoCliente = 'pendiente' | 'aprobado' | 'rechazado' | 'anonimo';

/**
 * Estado del cliente dentro del local, más allá de si su cuenta está
 * aprobada o no. "en_el_salon" todavía no se usa — queda para cuando el
 * metre pueda asignar mesas.
 */
export type EstadoEnEspera = 'rechazado' | 'en_la_lista' | 'en_el_salon';

export interface ClienteRow {
  id: string;
  nombre: string;
  apellido: string | null;
  dni: string | null;
  email: string | null;
  foto: string;
  estado: EstadoCliente;
  auth_customer_id: string | null;
  en_espera: EstadoEnEspera | null;
}

export interface NuevoClienteRegistrado {
  nombre: string;
  apellido: string;
  dni: string;
  email: string;
}