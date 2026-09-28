import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { restaurantOutline } from 'ionicons/icons';
import { MesaRow, etiquetaTipo } from '../../../core/models/mesa.model';
import { MesasService } from '../../../core/services/mesas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { estadoMesa } from '../../../core/utils/estado-visual';
import { AvatarPerfilComponent } from '../../../shared/components/avatar-perfil/avatar-perfil.component';
import { ChipEstadoComponent } from '../../../shared/components/chip-estado/chip-estado.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';

@Component({
  selector: 'app-mesas-mozo',
  standalone: true,
  imports: [
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    AlturaDisponibleDirective,
    AvatarPerfilComponent,
    ChipEstadoComponent,
    EstadoVacioComponent,
  ],
  templateUrl: './mesas-mozo.page.html',
  styleUrls: ['./mesas-mozo.page.scss'],
})
export class MesasMozoPage implements OnInit {
  private readonly router = inject(Router);
  private readonly mesasService = inject(MesasService);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);

  readonly cargando = signal(true);
  readonly perfil = signal<PerfilActual | null>(null);
  readonly mesas = signal<MesaRow[]>([]);

  readonly estadoMesa = estadoMesa;
  readonly etiquetaTipo = etiquetaTipo;

  constructor() {
    addIcons({ restaurantOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const [perfil, mesas] = await Promise.all([this.perfilActual.obtener(), this.mesasService.listar()]);
      this.perfil.set(perfil);
      this.mesas.set(mesas);
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.cargando()) this.mesas.set(await this.mesasService.listar());
  }

  abrir(mesa: MesaRow): void {
    this.router.navigate(['/mesa', mesa.id]);
  }

  comensales(cantidad: number): string {
    return cantidad === 1 ? '1 comensal' : `${cantidad} comensales`;
  }
}
