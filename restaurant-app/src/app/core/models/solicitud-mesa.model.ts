import { TipoMesa } from './mesa.model';

export type EstadoSolicitudMesa = 'en_espera' | 'aceptado' | 'rechazado' | 'vinculado' | 'finalizado';

/**
 * La solicitud del cliente. Mientras está 'en_espera' (o 'rechazado') todavía
 * no tiene mesa: la asigna el metre. Desde 'aceptado' en adelante sí.
 */
export interface MiSolicitud {
  id: string;
  estado: EstadoSolicitudMesa;
  mesa_id: string | null;
  numero_mesa: number | null;
  tipo: TipoMesa | null;
  cant_comensales: number | null;
  foto: string | null;
}

/** Solicitud con la mesa ya asignada ('aceptado' o 'vinculado'). */
export type SolicitudConMesa = MiSolicitud & {
  mesa_id: string;
  numero_mesa: number;
};

export function tieneMesa(solicitud: MiSolicitud): solicitud is SolicitudConMesa {
  return solicitud.mesa_id !== null && solicitud.numero_mesa !== null;
}

/** Estados que el metre ve en su lista. */
export type EstadoFilaListaEspera = 'en_espera' | 'aceptado' | 'vinculado';

export interface FilaListaEspera {
  id: string;
  cliente_id: string;
  estado: EstadoFilaListaEspera;
  nombre: string;
  apellido: string | null;
  foto: string;
  /** null mientras el metre no le asignó una mesa. */
  mesa_id: string | null;
  numero_mesa: number | null;
  tipo: TipoMesa | null;
  cant_comensales: number | null;
  created_at: string;
}