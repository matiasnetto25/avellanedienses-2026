import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Auth } from './auth';
import { NotificacionesService } from './notificaciones.service';

/**
 * Único punto de la app que cierra la sesión de un perfil con cuenta
 * (empleados y cliente registrado). El cliente anónimo no pasa por acá:
 * su «cerrar sesión» borra la cuenta completa y tiene reglas propias.
 *
 * No vive en Auth.logout() porque NotificacionesService ya inyecta Auth:
 * si Auth inyectara NotificacionesService se formaría una dependencia
 * circular y Angular fallaría al arrancar.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly auth = inject(Auth);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  async cerrarSesion(): Promise<void> {
    // Antes de invalidar la sesión: si no, el dispositivo seguía
    // recibiendo notificaciones de este usuario después de desloguearse.
    await this.notificaciones.eliminarTokenAlCerrarSesion();
    await this.auth.logout();
    // replaceUrl: true → el botón "atrás" no puede volver a la pantalla del perfil.
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }
}
