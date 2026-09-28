import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, restaurantOutline } from 'ionicons/icons';
import { MesaRow } from '../../../core/models/mesa.model';
import { Auth } from '../../../core/services/auth';
import { ClientesPendientesService } from '../../../core/services/clientes-pendientes.service';
import { LoadingService } from '../../../core/services/loading.service';
import { MesasService } from '../../../core/services/mesas.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { FilaClientePendienteComponent } from '../components/fila-cliente-pendiente/fila-cliente-pendiente.component';

const FILAS_POR_BLOQUE = 3;

@Component({
  selector: 'app-ahora-admin',
  standalone: true,
  imports: [
    RouterLink,
    IonContent,
    IonIcon,
    AlturaDisponibleDirective,
    EncabezadoPerfilComponent,
    EstadoVacioComponent,
    FilaClientePendienteComponent,
  ],
  templateUrl: './ahora-admin.page.html',
  styleUrls: ['./ahora-admin.page.scss'],
})
export class AhoraAdminPage implements OnInit {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly mesasService = inject(MesasService);
  private readonly pendientes = inject(ClientesPendientesService);
  private readonly sesion = inject(Auth).sesion;

  readonly titulo = computed(() => (this.sesion()?.puesto ?? 'dueño').toUpperCase());
  readonly cargando = signal(true);
  readonly perfil = signal<PerfilActual | null>(null);
  private readonly mesas = signal<MesaRow[]>([]);

  readonly cantidadPendientes = this.pendientes.cantidad;
  readonly clientes = computed(() => this.pendientes.filas().slice(0, FILAS_POR_BLOQUE));
  readonly ocupadas = computed(() => this.mesas().filter(m => m.disponibilidad === 'Ocupada').length);
  readonly libres = computed(() => this.mesas().length - this.ocupadas());
  readonly hayMesas = computed(() => this.mesas().length > 0);
  readonly todoEnOrden = computed(() => this.cantidadPendientes() === 0 && !this.hayMesas());

  readonly textoOcupadas = computed(() => (this.ocupadas() === 1 ? '1 mesa ocupada' : `${this.ocupadas()} mesas ocupadas`));
  readonly textoLibres = computed(() => (this.libres() === 1 ? '1 libre' : `${this.libres()} libres`));

  readonly resumen = computed(() => {
    const cifras: string[] = [];
    const pendientes = this.cantidadPendientes();
    if (pendientes > 0) cifras.push(`${pendientes} por aprobar`);
    if (this.hayMesas()) cifras.push(this.textoOcupadas());
    return cifras;
  });

  constructor() {
    addIcons({ chevronForwardOutline, restaurantOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      this.pendientes.iniciar();
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

  irAlSalon(): void {
    this.router.navigateByUrl('/administracion/salon');
  }
}
