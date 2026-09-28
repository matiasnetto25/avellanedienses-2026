import { Component, OnInit, inject, signal } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gameControllerOutline } from 'ionicons/icons';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { AvatarPerfilComponent } from '../../../shared/components/avatar-perfil/avatar-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';

@Component({
  selector: 'app-juegos-cliente',
  standalone: true,
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, AlturaDisponibleDirective, AvatarPerfilComponent, EstadoVacioComponent],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Juegos</ion-title>
        <app-avatar-perfil slot="end" [nombre]="perfil()?.nombre ?? ''" [foto]="perfil()?.foto ?? null" />
      </ion-toolbar>
    </ion-header>
    <ion-content class="densidad-amplia" appAlturaDisponible [margenAltura]="0" [descontarBarraGestos]="false">
      <app-estado-vacio
        icono="game-controller-outline"
        titulo="Los juegos llegan pronto"
        frase="Vas a poder ganar un descuento en tu cuenta." />
    </ion-content>
  `,
})
export class JuegosClientePage implements OnInit {
  private readonly perfilActual = inject(PerfilActualService);

  readonly perfil = signal<PerfilActual | null>(null);

  constructor() {
    addIcons({ gameControllerOutline });
  }

  async ngOnInit(): Promise<void> {
    this.perfil.set(await this.perfilActual.obtener());
  }
}
