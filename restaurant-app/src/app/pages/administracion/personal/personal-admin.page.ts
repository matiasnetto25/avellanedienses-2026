import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { idCardOutline } from 'ionicons/icons';
import { ClientesPendientesService } from '../../../core/services/clientes-pendientes.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { AvatarPerfilComponent } from '../../../shared/components/avatar-perfil/avatar-perfil.component';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { FilaClientePendienteComponent } from '../components/fila-cliente-pendiente/fila-cliente-pendiente.component';

type Vista = 'empleados' | 'clientes';

@Component({
  selector: 'app-personal-admin',
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonFooter,
    IonHeader,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToolbar,
    AlturaDisponibleDirective,
    AvatarPerfilComponent,
    BarraAccionesComponent,
    EstadoVacioComponent,
    FilaClientePendienteComponent,
  ],
  templateUrl: './personal-admin.page.html',
  styleUrls: ['./personal-admin.page.scss'],
})
export class PersonalAdminPage implements OnInit {
  private readonly nav = inject(NavController);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly pendientes = inject(ClientesPendientesService);

  readonly perfil = signal<PerfilActual | null>(null);
  readonly vista = signal<Vista>('empleados');
  readonly clientes = this.pendientes.filas;
  readonly cantidadClientes = this.pendientes.cantidad;
  readonly clientesCargados = this.pendientes.cargada;

  constructor() {
    addIcons({ idCardOutline });
    inject(ActivatedRoute).queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      if (params.get('vista') === 'clientes') this.vista.set('clientes');
    });
  }

  async ngOnInit(): Promise<void> {
    this.pendientes.iniciar();
    this.perfil.set(await this.perfilActual.obtener());
  }

  cambiarVista(valor: unknown): void {
    if (valor === 'empleados' || valor === 'clientes') this.vista.set(valor);
  }

  darDeAlta(): void {
    this.nav.navigateForward('/administracion/personal/alta');
  }
}
