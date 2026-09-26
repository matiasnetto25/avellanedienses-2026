import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { rutaHomeSegunPuesto } from '../models/rutas-por-puesto';
 
/**
 * No protege contenido propio — SIEMPRE redirige. Se usa en la ruta
 * "/inicio", que es el punto de entrada único después del login (o al
 * recargar la app con una sesión ya activa). Así login.page.ts no
 * necesita saber nada de rutas: solo navega a "/inicio" y esta guarda
 * decide a dónde va cada uno según su puesto.
 */
export const inicioGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);
  const s = auth.sesion();
 
  if (!s) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }
 
  router.navigate([rutaHomeSegunPuesto(s.puesto)], { replaceUrl: true });
  return false;
};