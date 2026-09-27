import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClienteActualService } from '../services/cliente-actual.service';
import { SolicitudesMesaService } from '../services/solicitudes-mesa.service';

/**
 * Deja pasar solo al cliente que está vinculado a la mesa de la URL
 * (parámetro :idMesa). Se usa en las pantallas de la estadía del cliente:
 * hoy /mesa/:idMesa/pedido, y la van a reusar /mesa/:idMesa/estado-pedido
 * (issue 06) y las pantallas de los puntos 13 y 14.
 *
 * A diferencia de los otros guards, este NO mira la sesión de Supabase
 * Auth: el cliente anónimo no tiene sesión, se lo identifica por el id
 * guardado en el dispositivo (Capacitor Preferences). Por eso usa
 * ClienteActualService, que resuelve tanto al anónimo como al registrado
 * aprobado.
 *
 * Si no pasa (no hay cliente, no está vinculado o es otra mesa), va a
 * /mesa/:idMesa: esa pantalla ya le explica el motivo a cada perfil
 * («Esta no es tu mesa», «Todavía no tenés una mesa asignada», etc.).
 */
export const estadiaEnMesaGuard: CanActivateFn = async (route) => {
  const clienteActual = inject(ClienteActualService);
  const solicitudesMesa = inject(SolicitudesMesaService);
  const router = inject(Router);

  const idMesa = route.paramMap.get('idMesa');
  if (!idMesa) {
    return router.createUrlTree(['/bienvenida']);
  }

  try {
    const clienteId = await clienteActual.obtenerClienteIdActual();
    const solicitud = clienteId ? await solicitudesMesa.obtenerMiSolicitud(clienteId) : null;

    if (solicitud?.estado === 'vinculado' && solicitud.mesa_id === idMesa) {
      return true;
    }
  } catch (error) {
    console.error('Error verificando la estadía en la mesa:', error);
  }

  return router.createUrlTree(['/mesa', idMesa]);
};
