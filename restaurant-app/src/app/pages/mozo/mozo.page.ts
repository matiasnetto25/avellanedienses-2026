import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../../shared/components/marca-header/marca-header.component';
import { Auth } from '../../core/services/auth';
import { AvisosService } from '../../core/services/avisos.service';
import { SesionService } from '../../core/services/sesion.service';

@Component({
  selector: 'app-mozo',
  standalone: true,
  imports: [IonContent, IonButton, RouterLink, MarcaHeaderComponent],
  templateUrl: './mozo.page.html',
  styleUrls: ['./mozo.page.scss'],
})
export class MozoPage {
  private readonly auth = inject(Auth);
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
}
