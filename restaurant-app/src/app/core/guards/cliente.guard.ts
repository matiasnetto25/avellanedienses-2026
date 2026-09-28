import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClienteActualService } from '../services/cliente-actual.service';

/**
 * Deja entrar a /cliente al cliente anónimo (id guardado en el dispositivo,
 * sin sesión de Auth) y al registrado aprobado. El resto va a la bienvenida.
 */
export const clienteGuard: CanActivateFn = async () => {
  const clienteActual = inject(ClienteActualService);
  const router = inject(Router);

  const clienteId = await clienteActual.obtenerClienteIdActual();
  return clienteId ? true : router.createUrlTree(['/bienvenida']);
};
