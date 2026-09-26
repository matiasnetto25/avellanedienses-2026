/**
 * Mensaje del chat de una estadía (tabla "mensajes_mesa"), ya aplanado
 * para la pantalla: el número de mesa, el cliente y el nombre del autor
 * salen de los joins con la estadía, la mesa, el cliente y el empleado.
 */
export interface MensajeMesa {
  id: string;
  /** Fecha ISO. Se formatea en la vista con DatePipe ('dd/MM/yyyy HH:mm'). */
  created_at: string;
  /** La estadía: fila de solicitudes_mesa en estado 'vinculado'. */
  solicitud_id: string;
  /** null = lo escribió el cliente de la estadía. */
  empleado_id: number | null;
  texto: string;
  numero_mesa: number;
  cliente_id: string;
  /** «Nombre Apellido» del cliente o del mozo que escribió. */
  autor_nombre: string;
}

/** Una estadía vinculada, tal como la ve el mozo en su lista de conversaciones. */
export interface ConversacionActiva {
  solicitud_id: string;
  cliente_id: string;
  numero_mesa: number;
  cliente_nombre: string;
  /** null si todavía nadie escribió en el chat. */
  ultimo_texto: string | null;
  ultimo_created_at: string | null;
  /** true si el último mensaje es del cliente. */
  sin_responder: boolean;
}

export const MAX_CARACTERES_MENSAJE = 300;

export function esDeCliente(mensaje: Pick<MensajeMesa, 'empleado_id'>): boolean {
  return mensaje.empleado_id === null;
}
