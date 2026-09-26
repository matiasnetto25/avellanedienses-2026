import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

/**
 * Guard opcional: exclusivo para "dueño".
 * No se usa todavía en ninguna ruta (la restricción de "quién puede crear
 * qué puesto" se resuelve dentro de personal.page.ts filtrando las opciones
 * del selector, más la revalidación en el servicio antes del INSERT).
 * Se deja disponible por si en el futuro se decide separar la ruta.
 */
export const duenoGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  if (auth.sesion()?.puesto === 'dueño' && auth.sesion()?.estado === 'On') {
    return true;
  }

  router.navigate(['/administracion'], { replaceUrl: true });
  return false;
};
