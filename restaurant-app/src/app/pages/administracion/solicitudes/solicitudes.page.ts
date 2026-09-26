import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonBackButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonButton,
} from '@ionic/angular/standalone';
import { AvisosService } from '../../../core/services/avisos.service';
import { ClientesService } from '../../../core/services/clientes.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ClienteRow } from '../../../core/models/cliente.model';

@Component({
  selector: 'app-solicitudes-clientes',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonBackButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonButton,
  ],
  templateUrl: './solicitudes.page.html',
  styleUrls: ['./solicitudes.page.scss'],
})
export class SolicitudesClientesPage implements OnInit {
  @ViewChild(IonContent) private readonly ionContent!: IonContent;
  private readonly avisos = inject(AvisosService);
  private readonly clientesService = inject(ClientesService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  readonly clientes = signal<ClienteRow[]>([]);
  readonly cargandoLista = signal(true);
  readonly procesandoId = signal<string | null>(null);

  /** Siempre 1 cliente por página (una card grande por pantalla). */
  readonly paginas = signal<ClienteRow[][]>([]);

  constructor() {
    effect(() => {
      const lista = this.clientes();
      this.paginas.set(lista.map((c) => [c]));
    });
  }

  async ngOnInit(): Promise<void> {
    await this.cargarPendientes();
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

    const paddingVertical = 32; // 16px arriba + 16px abajo
    const colchonExtra = 16;
    const safeAreaBottom = this.obtenerSafeAreaBottom();

    const alturaPagina = alturaTotal - paddingVertical - safeAreaBottom - colchonExtra;

    scrollEl.style.setProperty(
      '--altura-disponible',
      `${alturaPagina}px`
    );
  }

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

  async cargarPendientes(): Promise<void> {
    this.cargandoLista.set(true);
    this.loading.mostrar();
    try {
      this.clientes.set(await this.clientesService.listarPendientes());
    } finally {
      this.cargandoLista.set(false);
      this.loading.ocultar();
    }
    requestAnimationFrame(() => {
      this.medirAlturaDisponible();
    });
  }

  urlFoto(cliente: ClienteRow): string | null {
    return this.clientesService.obtenerUrlFoto(cliente.foto);
  }

  async aceptar(cliente: ClienteRow): Promise<void> {
    await this.procesar(cliente, true);
  }

  async rechazar(cliente: ClienteRow): Promise<void> {
    await this.procesar(cliente, false);
  }

  private async procesar(cliente: ClienteRow, aprobar: boolean): Promise<void> {
    if (this.procesandoId()) return;
    this.procesandoId.set(cliente.id);
    this.loading.mostrar();

    try {
      const resultado = await this.clientesService.actualizarEstado(
        cliente.id,
        aprobar ? 'aprobado' : 'rechazado',
        aprobar ? 'en_la_lista' : 'rechazado'
      );

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo procesar la solicitud.');
        return;
      }

      if (cliente.email) {
        await this.clientesService.enviarEmailResultado(cliente.email, cliente.nombre, aprobar);
      }

      this.notificaciones.notificarCreacion(
        aprobar ? 'Cliente aprobado' : 'Cliente rechazado',
        `${cliente.nombre} ${cliente.apellido} fue ${aprobar ? 'aceptado' : 'rechazado'}.`,
        { puestos: ['dueño', 'supervisor', 'metre'], ruta: '/administracion/solicitudes' }
      );

      this.clientes.update((lista) => lista.filter((c) => c.id !== cliente.id));
    } finally {
      this.procesandoId.set(null);
      this.loading.ocultar();
    }
  }
}
