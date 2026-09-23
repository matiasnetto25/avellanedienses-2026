import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';


/**
 * Protege /administracion y sus hijas.
 * No alcanza con ocultar botones (pedido explícito de la spec):
 * este guard corre server-side-friendly, no confía en el frontend visual.
 *
 * Nota: `restaurarSesion()` ya se llama al bootstrapear la app, así que acá
 * solo se lee el estado en memoria (signal), sin round-trip a Preferences.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.puedeAccederAdministracion()) {
    return true;
  }

  router.navigate(['/login'], { replaceUrl: true });
  return false;
};
