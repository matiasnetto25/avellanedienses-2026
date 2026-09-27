import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth } from '../services/auth';
import { Puesto } from '../models/empleado.model';

/**
 * Fábrica de guards por puesto: deja pasar solo a empleados activos
 * ('On') de alguno de los puestos indicados. El resto va al login.
 *
 *   canActivate: [puestoGuard('mozo')]
 *   canActivate: [puestoGuard(...PUESTOS_ADMIN)]
 *
 * No alcanza con ocultar botones: la ruta se protege acá aunque alguien
 * escriba la URL a mano.
 *
 * Arranque en frío: si la app abre directo en una ruta protegida (por
 * ejemplo, al tocar una push con la app cerrada o al recargar el
 * navegador), AppComponent puede no haber terminado restaurarSesion()
 * todavía. Por eso, si no hay sesión en memoria, se restaura antes de
 * decidir en lugar de mandar al login a alguien que sí tiene sesión.
 */
export function puestoGuard(...puestos: Puesto[]): CanActivateFn {
  return async () => {
    const auth = inject(Auth);
    const router = inject(Router);

    if (!auth.sesion()) {
      await auth.restaurarSesion();
    }

    const s = auth.sesion();
    if (s?.estado === 'On' && puestos.includes(s.puesto)) {
      return true;
    }

    // createUrlTree (en lugar de router.navigate) es la forma recomendada
    // por Angular: el router cancela esta navegación y hace la redirección
    // él mismo, sin navegaciones dobles.
    return router.createUrlTree(['/login']);
  };
}
