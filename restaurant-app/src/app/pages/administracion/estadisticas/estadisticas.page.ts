import { Component, OnInit, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { statsChartOutline } from 'ionicons/icons';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { AvatarPerfilComponent } from '../../../shared/components/avatar-perfil/avatar-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, AlturaDisponibleDirective, AvatarPerfilComponent, EstadoVacioComponent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Estadísticas</ion-title>
        <app-avatar-perfil slot="end" [nombre]="perfil()?.nombre ?? ''" [foto]="perfil()?.foto ?? null" />
      </ion-toolbar>
    </ion-header>

    <ion-content class="densidad-compacta" appAlturaDisponible [margenAltura]="0" [descontarBarraGestos]="false">
      <app-estado-vacio
        icono="stats-chart-outline"
        titulo="Las estadísticas llegan con las encuestas"
        frase="Vas a ver acá los resultados de las encuestas de satisfacción." />
    </ion-content>
  `,
})
export class EstadisticasPage implements OnInit {
  private readonly perfilActual = inject(PerfilActualService);

  readonly perfil = signal<PerfilActual | null>(null);

  constructor() {
    addIcons({ statsChartOutline });
  }

  async ngOnInit(): Promise<void> {
    this.perfil.set(await this.perfilActual.obtener());
  }
}
