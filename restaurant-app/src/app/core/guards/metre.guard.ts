import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';

export const metreGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const s = auth.sesion();

  if (s && s.estado === 'On' && s.puesto === 'metre') {
    return true;
  }

  router.navigate(['/login'], { replaceUrl: true });
  return false;
};