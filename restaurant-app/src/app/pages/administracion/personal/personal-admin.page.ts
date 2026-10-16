import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonHeader,
  IonTitle,
  IonToolbar,
  NavController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { idCardOutline } from 'ionicons/icons';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { AvatarPerfilComponent } from '../../../shared/components/avatar-perfil/avatar-perfil.component';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { ListaEmpleadosComponent } from '../components/lista-empleados/lista-empleados.component';

/**
 * Personal: la lista de empleados. Los clientes pendientes de aprobación
 * se resuelven en la pantalla «Ahora».
 */
@Component({
  selector: 'app-personal-admin',
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonFooter,
    IonHeader,
    IonTitle,
    IonToolbar,
    AlturaDisponibleDirective,
    AvatarPerfilComponent,
    BarraAccionesComponent,
    ListaEmpleadosComponent,
  ],
  templateUrl: './personal-admin.page.html',
  styleUrls: ['./personal-admin.page.scss'],
})
export class PersonalAdminPage implements OnInit {
  private readonly nav = inject(NavController);
  private readonly perfilActual = inject(PerfilActualService);

  readonly perfil = signal<PerfilActual | null>(null);
  /** true mientras la lista de empleados tiene una tarjeta en edición. */
  readonly editandoEmpleado = signal(false);

  constructor() {
    addIcons({ idCardOutline });
  }

  async ngOnInit(): Promise<void> {
    this.perfil.set(await this.perfilActual.obtener());
  }

  darDeAlta(): void {
    this.nav.navigateForward('/administracion/personal/alta');
  }
}