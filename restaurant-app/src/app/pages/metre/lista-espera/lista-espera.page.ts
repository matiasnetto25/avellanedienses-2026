import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonModal,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, peopleOutline, restaurantOutline } from 'ionicons/icons';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { ListaEsperaService } from '../../../core/services/lista-espera.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { ETIQUETA_PUESTO } from '../../../core/models/empleado.model';
import { AvisosService } from '../../../core/services/avisos.service';
import { SolicitudesMesaService } from '../../../core/services/solicitudes-mesa.service';
import { MesasService } from '../../../core/services/mesas.service';
import { ClientesService } from '../../../core/services/clientes.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { MesaRow, etiquetaTipo } from '../../../core/models/mesa.model';
import { ChipEstadoComponent } from '../../../shared/components/chip-estado/chip-estado.component';
import { estadoSolicitudMesa } from '../../../core/utils/estado-visual';
import { FilaListaEspera } from '../../../core/models/solicitud-mesa.model';

@Component({
  selector: 'app-lista-espera',
  standalone: true,
  imports: [
    AlturaDisponibleDirective,
    ChipEstadoComponent,
    CommonModule,
    EncabezadoPerfilComponent,
    IonContent,
    IonButton,
    IonIcon,
    IonModal,
  ],
  templateUrl: './lista-espera.page.html',
  styleUrls: ['./lista-espera.page.scss'],
})
export class ListaEsperaPage implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly clientes = inject(ClientesService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly mesasService = inject(MesasService);
  protected readonly listaEspera = inject(ListaEsperaService);

  constructor() {
    addIcons({ checkmarkCircle, peopleOutline, restaurantOutline });
  }

  readonly etiquetaTipo = etiquetaTipo;
  readonly estadoSolicitudMesa = estadoSolicitudMesa;
  // TODO(issue 26): "Metre" o "Maître" en pantalla.
  readonly titulo = ETIQUETA_PUESTO['metre'].toUpperCase();

  readonly filas = this.listaEspera.filas;
  readonly procesandoId = signal<string | null>(null);

  // Hoja «Asignar mesa»
  readonly filaAsignando = signal<FilaListaEspera | null>(null);
  readonly mesasLibres = signal<MesaRow[]>([]);
  readonly mesaElegidaId = signal<string | null>(null);
  /** Hasta 2 mesas: hoja baja, una sola fila. Más: hoja alta con 2 filas visibles (4 mesas) que se desliza de a una fila. */
  readonly hojaCompacta = computed(() => this.mesasLibres().length <= 2);
  readonly alturaHoja = computed(() => (this.hojaCompacta() ? 0.5 : 0.9));
  readonly asignando = signal(false);
  readonly nombreAsignando = computed(() => {
    const f = this.filaAsignando();
    return f ? `${f.nombre}${f.apellido ? ' ' + f.apellido : ''}` : '';
  });
  readonly perfil = signal<PerfilActual | null>(null);

  readonly resumen = computed(() => {
    const enEspera = this.listaEspera.enEspera();
    const porVincular = this.listaEspera.porVincular();
    const vinculados = this.listaEspera.vinculados();
    const cifras = [enEspera > 0 ? `${enEspera} en espera` : 'Nadie en espera'];
    if (porVincular > 0) cifras.push(`${porVincular} por escanear`);
    if (vinculados > 0) cifras.push(`${vinculados} en mesa`);
    return cifras;
  });

  async ngOnInit(): Promise<void> {
    this.listaEspera.iniciar();
    this.perfil.set(await this.perfilActual.obtener());
    if (!this.listaEspera.cargada()) {
      this.loading.mostrar();
      try {
        await this.listaEspera.refrescar();
      } finally {
        this.loading.ocultar();
      }
    }
  }

  iniciales(fila: FilaListaEspera): string {
    return `${fila.nombre} ${fila.apellido ?? ''}`
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(p => p[0].toUpperCase())
      .join('');
  }

  urlFoto(nombreArchivo: string): string | null {
    return this.clientes.obtenerUrlFoto(nombreArchivo);
  }

  /** El metre toca «Asignar mesa»: se abre la hoja con las mesas libres, con foto. */
  async asignar(fila: FilaListaEspera): Promise<void> {
    if (this.procesandoId()) return;
    this.procesandoId.set(fila.id);

    try {
      this.loading.mostrar();
      let mesas: MesaRow[];
      let fotos = new Map<string, string | null>();
      try {
        mesas = await this.solicitudesMesa.listarMesasLibres();
        // Por si la consulta de libres no trae la foto: se completa con la lista de mesas.
        if (mesas.some(m => !m.foto)) {
          fotos = new Map((await this.mesasService.listar()).map(m => [m.id, m.foto]));
        }
      } finally {
        this.loading.ocultar();
      }

      if (mesas.length === 0) {
        await this.avisos.advertencia('No hay mesas libres en este momento.');
        return;
      }

      this.mesasLibres.set(
        mesas
          .map(m => ({ ...m, foto: m.foto ?? fotos.get(m.id) ?? null }))
          .sort((x, y) => x.numero_mesa - y.numero_mesa)
      );
      this.mesaElegidaId.set(null);
      this.filaAsignando.set(fila);
    } finally {
      this.procesandoId.set(null);
    }
  }

  cerrarAsignacion(): void {
    if (this.asignando()) return;
    this.filaAsignando.set(null);
  }

  elegirMesa(mesa: MesaRow): void {
    this.mesaElegidaId.set(mesa.id);
  }

  urlFotoMesa(mesa: MesaRow): string | null {
    return this.mesasService.obtenerUrlFoto(mesa.foto);
  }

  /** Confirma la mesa elegida y se la asigna al cliente. */
  async confirmarAsignacion(): Promise<void> {
    const fila = this.filaAsignando();
    const mesa = this.mesasLibres().find(m => m.id === this.mesaElegidaId());
    if (!fila || !mesa || this.asignando()) return;

    this.asignando.set(true);
    this.loading.mostrar();
    try {
      const resultado = await this.solicitudesMesa.asignarMesa(fila.id, mesa.id);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo asignar la mesa.');
        // Alguien pudo ocupar la mesa: se vuelve a pedir la lista.
        this.filaAsignando.set(null);
        await this.listaEspera.refrescar();
        return;
      }

      this.filaAsignando.set(null);
      this.notificaciones.avisarMesaAsignada(fila.cliente_id, resultado.numero_mesa ?? mesa.numero_mesa);
      await this.listaEspera.refrescar();
    } finally {
      this.asignando.set(false);
      this.loading.ocultar();
    }
  }

  async rechazar(fila: FilaListaEspera): Promise<void> {
    if (this.procesandoId()) return;
    this.procesandoId.set(fila.id);
    this.loading.mostrar();

    try {
      const resultado = await this.solicitudesMesa.rechazarSolicitud(fila.id);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo rechazar la solicitud.');
        await this.listaEspera.refrescar();
        return;
      }

      this.notificaciones.avisarSolicitudRechazada(fila.cliente_id);

      this.listaEspera.quitar(fila.id);
    } finally {
      this.procesandoId.set(null);
      this.loading.ocultar();
    }
  }
}