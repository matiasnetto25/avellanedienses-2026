import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from './auth';

/**
 * Único punto de la app que cierra la sesión de un perfil con cuenta
 * (empleados y cliente registrado). El cliente anónimo no pasa por acá:
 * su «cerrar sesión» borra la cuenta completa y tiene reglas propias.
 *
 * El token de push del dispositivo lo borra NotificacionesService, que
 * se anota en Auth.alCerrarSesion(): así se borra también cuando la
 * sesión expira sola a la hora, no solo con el botón.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);

  async cerrarSesion(): Promise<void> {
    await this.auth.logout();
    // replaceUrl: true → el botón "atrás" no puede volver a la pantalla del perfil.
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }
}
