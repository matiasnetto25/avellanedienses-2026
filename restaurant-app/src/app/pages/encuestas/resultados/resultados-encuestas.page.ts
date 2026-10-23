import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOfflineOutline } from 'ionicons/icons';
import { ResultadosEncuestas } from '../../../core/models/encuesta.model';
import { AvisosService } from '../../../core/services/avisos.service';
import { EncuestasService } from '../../../core/services/encuestas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { GraficosEncuestasComponent } from '../components/graficos-encuestas/graficos-encuestas.component';

/**
 * Resultados de las encuestas para el cliente (punto 20, issue 05). La ve
 * cualquier cliente: con la encuesta ya completada, sin mesa o en la lista
 * de espera (QR de ingreso, puntos 9 y 22).
 *
 * Los gráficos van en un carrusel, uno por pantalla (app-graficos-encuestas).
 */
@Component({
  selector: 'app-resultados-encuestas',
  standalone: true,
  imports: [
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonTitle,
    IonToolbar,
    AlturaDisponibleDirective,
    BarraAccionesComponent,
    EstadoVacioComponent,
    GraficosEncuestasComponent,
  ],
  templateUrl: './resultados-encuestas.page.html',
  styleUrls: ['./resultados-encuestas.page.scss'],
})
export class ResultadosEncuestasPage {
  private readonly encuestas = inject(EncuestasService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly router = inject(Router);

  readonly resultados = signal<ResultadosEncuestas | null>(null);
  readonly cargando = signal(true);
  readonly fallo = signal(false);

  constructor() {
    addIcons({ cloudOfflineOutline });
  }

  /** Se recarga cada vez que se entra: así aparece la encuesta recién enviada. */
  async ionViewWillEnter(): Promise<void> {
    this.cargando.set(true);
    const resultados = await this.loading.envolver(this.encuestas.obtenerResultados());
    this.cargando.set(false);
    this.fallo.set(resultados === null);
    this.resultados.set(resultados);
    if (resultados === null) {
      await this.avisos.error('No se pudieron cargar los resultados. Revisá tu conexión.');
    }
  }

  volverAlInicio(): void {
    this.router.navigate(['/cliente/inicio']);
  }
}
