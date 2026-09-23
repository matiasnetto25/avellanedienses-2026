import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { Auth } from '../../core/services/auth';
import { NotificacionesService } from '../../core/services/notificaciones.service';

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './administracion.page.html',
  styleUrls: ['./administracion.page.scss'],
})
export class AdministracionPage {
  private readonly auth = inject(Auth);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly router = inject(Router);

  readonly sesion = this.auth.sesion;

  get nombreCompleto(): string {
    const s = this.sesion();
    return s ? `${s.nombre} ${s.apellido}` : '';
  }

  get puestoActual(): string {
    const s = this.sesion();
    if (!s) return '';
    return s.puesto.charAt(0).toUpperCase() + s.puesto.slice(1);
  }

  get fotoEmpleado(): string | null {
    return this.sesion()?.foto ?? null;
  }

  async irAPersonal(): Promise<void> {
    this.router.navigate(['/administracion/personal']);
  }

  crearMesa(): void {
    this.router.navigate(['/administracion/salon/crear']);
  }

  gestionMesas(): void {
    this.router.navigate(['/administracion/salon/gestion']);
  }

  irASolicitudes(): void {
    this.router.navigate(['/administracion/solicitudes']);
  }

  async cerrarSesion(): Promise<void> {
    // Antes de invalidar la sesión: si no, el dispositivo seguía
    // recibiendo notificaciones de este empleado después de desloguearse.
    await this.notificaciones.eliminarTokenAlCerrarSesion();
    await this.auth.logout();
    // replaceUrl: true → el botón "atrás" del navegador no puede volver a /administracion
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }
}
