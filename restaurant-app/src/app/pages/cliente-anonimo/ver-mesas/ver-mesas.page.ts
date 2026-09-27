import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonButton } from '@ionic/angular/standalone';
import { AvisosService } from '../../../core/services/avisos.service';
import { ClienteAnonimoService } from '../../../core/services/cliente-anonimo.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { MesasService } from '../../../core/services/mesas.service';
import { MesaRow, etiquetaTipo } from '../../../core/models/mesa.model';
import { MiSolicitud } from '../../../core/models/solicitud-mesa.model';

@Component({
  selector: 'app-ver-mesas',
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonBackButton, IonButtons, IonCard, IonCardContent, IonButton],
  templateUrl: './ver-mesas.page.html',
  styleUrls: ['./ver-mesas.page.scss'],
})
export class VerMesasPage implements OnInit {
  @ViewChild(IonContent) private readonly ionContent!: IonContent;
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly mesasService = inject(MesasService);

  readonly etiquetaTipo = etiquetaTipo;

  urlFoto(mesa: MesaRow): string | null {
    return this.mesasService.obtenerUrlFoto(mesa.foto);
  }

  urlFotoSolicitud(nombreArchivo: string | null): string | null {
    return this.mesasService.obtenerUrlFoto(nombreArchivo);
  }

  irAEscanearMesa(): void {
    this.router.navigate(['/cliente-anonimo/escaneo-mesa']);
  }

  irAMiMesa(mesaId: string): void {
    this.router.navigate(['/mesa', mesaId]);
  }

  private clienteId: string | null = null;
  readonly cargandoLista = signal(true);
  readonly mesas = signal<MesaRow[]>([]);
  readonly miSolicitud = signal<MiSolicitud | null>(null);
  readonly solicitando = signal<string | null>(null);

  /** Siempre 1 mesa por página. */
  readonly paginas = signal<MesaRow[][]>([]);

  constructor() {
    effect(() => {
      const lista = this.mesas();
      this.paginas.set(lista.map((m) => [m]));
    });
  }

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async ionViewDidEnter(): Promise<void> {
    await this.medirAlturaDisponible();
  }

  @HostListener('window:resize')
  async onResize(): Promise<void> {
    await this.medirAlturaDisponible();
  }

  private async medirAlturaDisponible(): Promise<void> {
    if (!this.ionContent) return;
    const scrollEl = await this.ionContent.getScrollElement();
    const alturaTotal = scrollEl.clientHeight;
    if (!alturaTotal) return;
    const margenSeguridad = 32;
    const colchonExtra = 16;
    const safeAreaBottom = this.obtenerSafeAreaBottom();
    scrollEl.style.setProperty(
      '--altura-disponible',
      `${alturaTotal - margenSeguridad - safeAreaBottom - colchonExtra}px`
    );
  }

  /**
   * Lee el alto real (en px) de env(safe-area-inset-bottom) — la franja
   * que ocupan los botones de gestos de Android en la parte de abajo.
   * clientHeight de ion-content NO la descuenta sola, así que si no la
   * restamos acá, el último botón de la card queda tapado por esos
   * botones del sistema.
   */
  private obtenerSafeAreaBottom(): number {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.bottom = '0';
    div.style.visibility = 'hidden';
    div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    document.body.appendChild(div);
    const valor = parseFloat(getComputedStyle(div).paddingBottom) || 0;
    document.body.removeChild(div);
    return valor;
  }

  async cargar(): Promise<void> {
    this.cargandoLista.set(true);
    this.loading.mostrar();

    try {
      const cliente = await this.clienteAnonimo.obtenerClienteActual();
      if (!cliente) {
        await this.avisos.error('No se pudo identificar tu ingreso. Volvé a intentar desde el inicio.');
        return;
      }
      this.clienteId = cliente.id;

      const solicitud = await this.clienteAnonimo.obtenerMiSolicitud(cliente.id);
      this.miSolicitud.set(solicitud);

      if (!solicitud) {
        this.mesas.set(await this.clienteAnonimo.listarMesas());
      }
    } finally {
      this.cargandoLista.set(false);
      this.loading.ocultar();
    }

    requestAnimationFrame(() => {
      this.medirAlturaDisponible();
    });
  }

  async solicitar(mesa: MesaRow): Promise<void> {
    if (!this.clienteId || this.solicitando()) return;
    this.solicitando.set(mesa.id);
    this.loading.mostrar();

    try {
      const resultado = await this.clienteAnonimo.crearSolicitud(this.clienteId, mesa.id);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo solicitar la mesa.');
        // Puede que se nos haya adelantado alguien: refrescamos la lista.
        await this.cargar();
        return;
      }

      this.notificaciones.avisarClienteEnListaEspera(mesa.numero_mesa);

      // Actualiza la interfaz al toque, sin esperar a recargar del todo.
      this.miSolicitud.set({
        id: '',
        estado: 'en_espera',
        mesa_id: mesa.id,
        numero_mesa: mesa.numero_mesa,
        tipo: mesa.tipo,
        cant_comensales: mesa.cant_comensales,
        foto: mesa.foto,
      });
    } finally {
      this.solicitando.set(null);
      this.loading.ocultar();
    }
  }
}
