import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { Auth } from '../../core/services/auth';
import { AvisosService } from '../../core/services/avisos.service';
import { SesionService } from '../../core/services/sesion.service';

@Component({
  selector: 'app-metre',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './metre.page.html',
  styleUrls: ['./metre.page.scss'],
})
export class MetrePage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  protected readonly avisos = inject(AvisosService);
  protected readonly sesionService = inject(SesionService);

  readonly sesion = this.auth.sesion;

  get nombreCompleto(): string {
    const s = this.sesion();
    return s ? `${s.nombre} ${s.apellido}` : '';
  }

  get fotoEmpleado(): string | null {
    return this.sesion()?.foto ?? null;
  }

  registrarCliente(): void {
    this.router.navigate(['/registrar-cliente']);
  }

  listaDeEspera(): void {
    this.router.navigate(['/metre/lista-espera']);
  }
}
