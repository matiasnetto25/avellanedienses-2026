import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  RefresherCustomEvent,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { ResultadosEncuestas } from '../../../core/models/encuesta.model';
import { AvisosService } from '../../../core/services/avisos.service';
import { EncuestasService } from '../../../core/services/encuestas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { AvatarPerfilComponent } from '../../../shared/components/avatar-perfil/avatar-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { GraficosEncuestasComponent } from '../../encuestas/components/graficos-encuestas/graficos-encuestas.component';

/**
 * Pestaña Estadísticas del dueño y del supervisor (punto 20, issue 06): los
 * resultados de las encuestas de satisfacción, con los mismos gráficos que
 * ve el cliente pero uno abajo del otro (cada uno del alto de la pantalla).
 */
@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonRefresher,
    IonRefresherContent,
    IonTitle,
    IonToolbar,
    AlturaDisponibleDirective,
    AvatarPerfilComponent,
    EstadoVacioComponent,
    GraficosEncuestasComponent,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Estadísticas</ion-title>
        <app-avatar-perfil slot="end" [nombre]="perfil()?.nombre ?? ''" [foto]="perfil()?.foto ?? null" />
      </ion-toolbar>
    </ion-header>

    <ion-content class="densidad-compacta" appAlturaDisponible [margenAltura]="0" [descontarBarraGestos]="false">
      <ion-refresher slot="fixed" (ionRefresh)="recargar($event)">
        <ion-refresher-content />
      </ion-refresher>

      <div class="pantalla">
        @if (!cargando()) {
          @if (resultados(); as r) {
            <!-- Uno abajo del otro, cada uno del alto de la pantalla. Con cero
                 encuestas, el propio componente muestra el estado vacío. -->
            <app-graficos-encuestas [resultados]="r" disposicion="vertical" />
          } @else {
            <app-estado-vacio
              icono="cloud-offline-outline"
              titulo="No se pudieron cargar las estadísticas"
              frase="Revisá tu conexión y deslizá hacia abajo para volver a intentar." />
          }
        }
      </div>
    </ion-content>
  `,
  styles: `
    /* Alto fijo (no mínimo): Chart.js mide su contenedor y, si puede crecer,
       se estira y empuja la navegación del carrusel fuera de la pantalla. */
    .pantalla {
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      height: var(--altura-disponible, 100%);
      padding: var(--espacio-4) var(--margen-pantalla);
    }

    app-estado-vacio {
      flex: 1;
      min-height: 0;
    }
  `,
})
export class EstadisticasPage implements OnInit {
  private readonly perfilActual = inject(PerfilActualService);
  private readonly encuestas = inject(EncuestasService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  readonly perfil = signal<PerfilActual | null>(null);
  readonly resultados = signal<ResultadosEncuestas | null>(null);
  readonly cargando = signal(true);

  constructor() {
    addIcons({ cloudOfflineOutline });
  }

  async ngOnInit(): Promise<void> {
    this.perfil.set(await this.perfilActual.obtener());
  }

  /**
   * En ionViewWillEnter y no en ngOnInit: las pestañas quedan vivas en
   * memoria, y así cada vez que se vuelve aparecen las encuestas nuevas.
   */
  async ionViewWillEnter(): Promise<void> {
    await this.loading.envolver(this.cargar());
  }

  async recargar(evento: RefresherCustomEvent): Promise<void> {
    await this.cargar();
    await evento.target.complete();
  }

  private async cargar(): Promise<void> {
    const resultados = await this.encuestas.obtenerResultados();
    this.resultados.set(resultados);
    this.cargando.set(false);
    if (resultados === null) {
      await this.avisos.error('No se pudieron cargar las estadísticas. Revisá tu conexión.');
    }
  }
}
