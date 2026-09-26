import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { Auth } from '../../core/services/auth';
import { SesionService } from '../../core/services/sesion.service';

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './administracion.page.html',
  styleUrls: ['./administracion.page.scss'],
})
export class AdministracionPage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly sesionService = inject(SesionService);

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
}
