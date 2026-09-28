import { Puesto } from './empleado.model';

/**
 * Centraliza "a dónde va cada puesto al loguearse". Si mañana se agrega
 * un panel nuevo, se cambia UNA sola vez acá — no hay que salir a
 * buscar el if/else repetido en login.page.ts, guards, etc.
 */
export function rutaHomeSegunPuesto(puesto: Puesto): string {
  switch (puesto) {
    case 'dueño':
    case 'supervisor':
      return '/administracion';
    case 'cocinero':
      return '/cocina/ahora';
    case 'cantinero':
      return '/cantina/ahora';
    case 'metre':
      return '/metre/lista-espera';
    case 'mozo':
      return '/mozo/ahora';
    default:
      return '/principal';
  }
}