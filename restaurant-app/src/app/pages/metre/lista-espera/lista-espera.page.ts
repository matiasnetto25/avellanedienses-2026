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
import { ClienteAnonimoService } from '../../../core/services/cliente-anonimo.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { etiquetaTipo } from '../../../core/models/mesa.model';
import { FilaListaEspera } from '../../../core/models/solicitud-mesa.model';

@Component({
  selector: 'app-lista-espera',
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
  templateUrl: './lista-espera.page.html',
  styleUrls: ['./lista-espera.page.scss'],
})
export class ListaEsperaPage implements OnInit {
  @ViewChild(IonContent) private readonly ionContent!: IonContent;
  private readonly avisos = inject(AvisosService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  readonly etiquetaTipo = etiquetaTipo;

  readonly filas = signal<FilaListaEspera[]>([]);
  readonly cargandoLista = signal(true);
  readonly procesandoId = signal<string | null>(null);

  /** Siempre 1 solicitud por página. */
  readonly paginas = signal<FilaListaEspera[][]>([]);

  constructor() {
    effect(() => {
      const lista = this.filas();
      this.paginas.set(lista.map((f) => [f]));
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
    const colchonExtra = 32;
    const safeAreaBottom = this.obtenerSafeAreaBottom();
    scrollEl.style.setProperty(
      '--altura-disponible',
      `${alturaTotal - margenSeguridad - safeAreaBottom - colchonExtra}px`
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

  async cargar(): Promise<void> {
    this.cargandoLista.set(true);
    this.loading.mostrar();
    try {
      this.filas.set(await this.clienteAnonimo.listarListaEspera());
    } finally {
      this.cargandoLista.set(false);
      this.loading.ocultar();
    }
    requestAnimationFrame(() => {
      this.medirAlturaDisponible();
    });
  }

  urlFoto(nombreArchivo: string): string | null {
    return this.clienteAnonimo.obtenerUrlFoto(nombreArchivo);
  }

  async aceptar(fila: FilaListaEspera): Promise<void> {
    if (this.procesandoId()) return;
    this.procesandoId.set(fila.id);
    this.loading.mostrar();

    try {
      const resultado = await this.clienteAnonimo.aceptarSolicitud(fila.id);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo aceptar la solicitud.');
        await this.cargar();
        return;
      }

      this.notificaciones.avisarMesaAsignada(fila.cliente_id);

      this.filas.update((lista) => lista.filter((f) => f.id !== fila.id));
    } finally {
      this.procesandoId.set(null);
      this.loading.ocultar();
    }
  }

  async rechazar(fila: FilaListaEspera): Promise<void> {
    if (this.procesandoId()) return;
    this.procesandoId.set(fila.id);
    this.loading.mostrar();

    try {
      const resultado = await this.clienteAnonimo.rechazarSolicitud(fila.id);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo rechazar la solicitud.');
        await this.cargar();
        return;
      }

      this.notificaciones.avisarSolicitudRechazada(fila.cliente_id);

      this.filas.update((lista) => lista.filter((f) => f.id !== fila.id));
    } finally {
      this.procesandoId.set(null);
      this.loading.ocultar();
    }
  }
}
