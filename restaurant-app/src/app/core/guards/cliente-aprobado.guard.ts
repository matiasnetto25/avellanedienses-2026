import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ClientesService } from '../services/clientes.service';

/**
 * Deja entrar a /cliente solo a un cliente registrado y aprobado con
 * sesión activa. El resto va al login.
 */
export const clienteAprobadoGuard: CanActivateFn = async () => {
  const clientes = inject(ClientesService);
  const router = inject(Router);

  const cliente = await clientes.obtenerClienteActual();
  if (cliente?.estado === 'aprobado') {
    return true;
  }

  return router.createUrlTree(['/login']);
};
