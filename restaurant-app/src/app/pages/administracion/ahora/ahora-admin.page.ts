import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkDoneOutline, chevronForwardOutline, restaurantOutline } from 'ionicons/icons';
import { MesaRow } from '../../../core/models/mesa.model';
import { Auth } from '../../../core/services/auth';
import { ClientesPendientesService } from '../../../core/services/clientes-pendientes.service';
import { ListaEsperaService } from '../../../core/services/lista-espera.service';
import { LoadingService } from '../../../core/services/loading.service';
import { MesasService } from '../../../core/services/mesas.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { FilasEnterasDirective } from '../../../shared/directives/filas-enteras.directive';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { FilaClientePendienteComponent } from '../components/fila-cliente-pendiente/fila-cliente-pendiente.component';

/** Cada cuánto se vuelven a pedir las listas mientras el dueño está en esta pantalla. */
const INTERVALO_ACTUALIZACION_MS = 3000;

@Component({
  selector: 'app-ahora-admin',
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    AlturaDisponibleDirective,
    EncabezadoPerfilComponent,
    FilaClientePendienteComponent,
    FilasEnterasDirective,
  ],
  templateUrl: './ahora-admin.page.html',
  styleUrls: ['./ahora-admin.page.scss'],
})
export class AhoraAdminPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly mesasService = inject(MesasService);
  private readonly pendientes = inject(ClientesPendientesService);
  private readonly listaEspera = inject(ListaEsperaService);
  private readonly sesion = inject(Auth).sesion;
  private temporizador: ReturnType<typeof setInterval> | null = null;

  readonly titulo = computed(() => (this.sesion()?.puesto ?? 'dueño').toUpperCase());
  readonly cargando = signal(true);
  readonly perfil = signal<PerfilActual | null>(null);
  private readonly mesas = signal<MesaRow[]>([]);

  readonly cantidadPendientes = this.pendientes.cantidad;
  readonly clientes = computed(() => this.pendientes.filas());
  /** Clientes que escanearon el QR de ingreso y esperan mesa (se actualiza solo, por Realtime). */
  readonly enEspera = computed(() => this.listaEspera.filas().filter(f => f.estado === 'en_espera'));
  readonly cantidadEnEspera = computed(() => this.enEspera().length);
  readonly ocupadas = computed(() => this.mesas().filter(m => m.disponibilidad === 'Ocupada').length);
  readonly libres = computed(() => this.mesas().length - this.ocupadas());
  readonly hayMesas = computed(() => this.mesas().length > 0);

  readonly textoOcupadas = computed(() => (this.ocupadas() === 1 ? '1 mesa ocupada' : `${this.ocupadas()} mesas ocupadas`));
  readonly textoLibres = computed(() => (this.libres() === 1 ? '1 libre' : `${this.libres()} libres`));

  readonly resumen = computed(() => {
    const cifras: string[] = [];
    const pendientes = this.cantidadPendientes();
    if (pendientes > 0) cifras.push(`${pendientes} por aprobar`);
    if (this.cantidadEnEspera() > 0) cifras.push(`${this.cantidadEnEspera()} en espera`);
    if (this.hayMesas()) cifras.push(this.textoOcupadas());
    return cifras;
  });

  constructor() {
    addIcons({ checkmarkDoneOutline, chevronForwardOutline, restaurantOutline });
  }

  private dejarDeObservarMesas: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    // Mesas ocupadas y libres en tiempo real.
    this.dejarDeObservarMesas = this.mesasService.observar(
      () => void this.mesasService.listar().then((mesas) => this.mesas.set(mesas))
    );
    this.loading.mostrar();
    try {
      this.pendientes.iniciar();
      this.listaEspera.iniciar();
      const [perfil, mesas] = await Promise.all([this.perfilActual.obtener(), this.mesasService.listar()]);
      this.perfil.set(perfil);
      this.mesas.set(mesas);
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  async ionViewWillEnter(): Promise<void> {
    this.vigilarListaEspera();
    if (!this.cargando()) this.mesas.set(await this.mesasService.listar());
  }

  ionViewWillLeave(): void {
    this.dejarDeVigilar();
  }

  ngOnDestroy(): void {
    this.dejarDeObservarMesas?.();
    this.dejarDeVigilar();
  }

  /**
   * Mientras el dueño mira esta pantalla, la lista de espera y los clientes
   * pendientes se vuelven a pedir cada pocos segundos. Realtime solo avisa si el rol puede leer la
   * tabla; esto asegura que un cliente nuevo aparezca enseguida igual.
   */
  private vigilarListaEspera(): void {
    this.dejarDeVigilar();
    this.actualizarAvisos();
    this.temporizador = setInterval(() => this.actualizarAvisos(), INTERVALO_ACTUALIZACION_MS);
  }

  /** Vuelve a pedir lo que el dueño tiene que ver: clientes en espera y clientes pendientes de aprobación. */
  private actualizarAvisos(): void {
    void this.listaEspera.refrescar();
    void this.pendientes.refrescar();
  }

  private dejarDeVigilar(): void {
    if (this.temporizador) clearInterval(this.temporizador);
    this.temporizador = null;
  }

  iniciales(nombre: string, apellido: string | null): string {
    return `${nombre} ${apellido ?? ''}`.split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('');
  }

  irAlSalon(): void {
    this.router.navigateByUrl('/administracion/salon');
  }
}