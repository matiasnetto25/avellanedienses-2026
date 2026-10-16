import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { ClienteActualService } from '../services/cliente-actual.service';
import { SolicitudesMesaService } from '../services/solicitudes-mesa.service';

/**
 * El menú solo lo ve:
 *  - el personal con sesión activa, o
 *  - el cliente (anónimo o registrado) que ya está VINCULADO a su mesa, es
 *    decir, que el metre se la asignó y él escaneó el QR de esa mesa.
 *
 * Cualquier otro (sin mesa, en la lista de espera o con la mesa asignada
 * pero sin escanear) vuelve a su inicio, donde le dice qué le falta.
 */
export const menuGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  const clienteActual = inject(ClienteActualService);
  const solicitudesMesa = inject(SolicitudesMesaService);
  const router = inject(Router);

  if (!auth.sesion()) {
    await auth.restaurarSesion();
  }
  if (auth.sesion()?.estado === 'On') return true;

  try {
    const clienteId = await clienteActual.obtenerClienteIdActual();
    const solicitud = clienteId ? await solicitudesMesa.obtenerMiSolicitud(clienteId) : null;
    if (solicitud?.estado === 'vinculado') return true;
  } catch (error) {
    console.error('Error verificando el acceso al menú:', error);
  }

  return router.createUrlTree(['/cliente/inicio']);
};