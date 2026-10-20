import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { wineOutline } from 'ionicons/icons';
import { EstadoItem, ItemComanda, SectorItem } from '../../core/models/pedido.model';
import { PedidosService } from '../../core/services/pedidos.service';
import { AvisosService } from '../../core/services/avisos.service';
import { NotificacionesService } from '../../core/services/notificaciones.service';
import { LoadingService } from '../../core/services/loading.service';
import { PerfilActual, PerfilActualService } from '../../core/services/perfil-actual.service';
import { estadoItem } from '../../core/utils/estado-visual';
import { EncabezadoPerfilComponent } from '../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { EstadoVacioComponent } from '../../shared/components/estado-vacio/estado-vacio.component';
import { ChipEstadoComponent } from '../../shared/components/chip-estado/chip-estado.component';
import { AlturaDisponibleDirective } from '../../shared/directives/altura-disponible.directive';

interface GrupoMesa {
  pedidoId: string;
  numeroMesa: number;
  fecha: string;
  items: ItemComanda[];
}

interface Bloque {
  estado: EstadoItem;
  titulo: string;
  grupos: GrupoMesa[];
  cantidad: number;
}

const TEXTOS_POR_SECTOR: Record<SectorItem, { titulo: string; icono: string }> = {
  cocina: { titulo: 'COCINA', icono: 'flame-outline' },
  bar: { titulo: 'CANTINA', icono: 'wine-outline' },
};

function agruparPorMesa(items: ItemComanda[]): GrupoMesa[] {
  const grupos = new Map<string, GrupoMesa>();
  for (const item of items) {
    const grupo = grupos.get(item.pedidoId);
    if (grupo) {
      grupo.items.push(item);
    } else {
      grupos.set(item.pedidoId, { pedidoId: item.pedidoId, numeroMesa: item.numeroMesa, fecha: item.fecha, items: [item] });
    }
  }
  return [...grupos.values()];
}

@Component({
  selector: 'app-ahora-preparacion',
  standalone: true,
  imports: [
    AlturaDisponibleDirective,
    ChipEstadoComponent,
    DatePipe,
    EncabezadoPerfilComponent,
    EstadoVacioComponent,
    IonButton,
    IonContent,
  ],
  templateUrl: './ahora-preparacion.page.html',
  styleUrls: ['./ahora-preparacion.page.scss'],
})
export class AhoraPreparacionPage implements OnInit, OnDestroy {
  private readonly pedidosService = inject(PedidosService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly sector: SectorItem = inject(ActivatedRoute).snapshot.data['sector'];
  readonly textos = TEXTOS_POR_SECTOR[this.sector];
  readonly estadoItem = estadoItem;

  readonly perfil = signal<PerfilActual | null>(null);
  readonly cargando = signal(true);
  readonly comandas = signal<ItemComanda[]>([]);
  /** Pedido que se está pasando a «en preparación»: deshabilita su botón. */
  readonly enviando = signal<string | null>(null);

  readonly bloques = computed<Bloque[]>(() =>
    [
      this.bloque('Por preparar', 'pendiente'),
      this.bloque('En preparación', 'en_preparacion'),
    ].filter((b) => b.cantidad > 0)
  );

  readonly resumen = computed(() =>
    this.bloques().map((b) => `${b.cantidad} ${b.titulo.toLowerCase()}`)
  );

  private dejarDeEscuchar: (() => void) | null = null;

  constructor() {
    addIcons({ wineOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      this.perfil.set(await this.perfilActual.obtener());
      await this.cargar();
      this.dejarDeEscuchar = this.pedidosService.suscribirseAComandas(this.sector, () => this.cargar());
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar?.();
  }

  /** El cocinero (o cantinero) toma todos los productos pendientes de una mesa. */
  async empezar(grupo: GrupoMesa): Promise<void> {
    if (this.enviando()) return;
    const ids = grupo.items.filter((i) => i.estado === 'pendiente').map((i) => i.id);

    this.enviando.set(grupo.pedidoId);
    this.loading.mostrar();
    try {
      const resultado = await this.pedidosService.empezarPreparacion(ids);
      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo empezar la preparación.');
      } else {
        if (resultado.clienteId && resultado.mesaId) {
          this.notificaciones.avisarPreparacionIniciada(resultado.clienteId, resultado.mesaId, this.sector);
        }
        await this.avisos.exito(`Mesa ${grupo.numeroMesa}: en preparación.`);
      }
      await this.cargar();
    } finally {
      this.enviando.set(null);
      this.loading.ocultar();
    }
  }

  private bloque(titulo: string, estado: EstadoItem): Bloque {
    const items = this.comandas().filter((i) => i.estado === estado);
    return { estado, titulo, grupos: agruparPorMesa(items), cantidad: items.length };
  }

  private async cargar(): Promise<void> {
    const comandas = await this.pedidosService.listarComandas(this.sector);
    if (comandas === null) {
      await this.avisos.error('No se pudieron cargar los pedidos. Probá de nuevo.');
      return;
    }
    this.comandas.set(comandas);
  }
}
