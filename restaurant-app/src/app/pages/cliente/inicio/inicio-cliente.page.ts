import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonFooter, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubblesOutline,
  chevronForwardOutline,
  closeCircleOutline,
  qrCodeOutline,
  receiptOutline,
  starOutline,
  syncOutline,
  timeOutline,
} from 'ionicons/icons';
import { EtapaClienteService } from '../../../core/services/etapa-cliente.service';
import { LoadingService } from '../../../core/services/loading.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { estadoSolicitudMesa } from '../../../core/utils/estado-visual';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { ChipEstadoComponent } from '../../../shared/components/chip-estado/chip-estado.component';
import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AvisoRechazoService } from '../../pedidos/cliente/components/aviso-rechazo/aviso-rechazo.service';
import { TarjetaEstadoPedidoComponent } from '../../pedidos/cliente/components/tarjeta-estado-pedido/tarjeta-estado-pedido.component';

type AccionPrincipal = 'escanear-entrada' | 'escanear-mesa' | 'ver-menu';

@Component({
  selector: 'app-inicio-cliente',
  standalone: true,
  imports: [
    IonContent,
    IonFooter,
    IonButton,
    IonIcon,
    BarraAccionesComponent,
    ChipEstadoComponent,
    EncabezadoPerfilComponent,
    EstadoVacioComponent,
    TarjetaEstadoPedidoComponent,
  ],
  templateUrl: './inicio-cliente.page.html',
  styleUrls: ['./inicio-cliente.page.scss'],
})
export class InicioClientePage implements OnInit {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly etapaCliente = inject(EtapaClienteService);
  private readonly avisoRechazo = inject(AvisoRechazoService);

  readonly perfil = signal<PerfilActual | null>(null);
  readonly etapa = this.etapaCliente.etapa;
  readonly solicitudRechazada = this.etapaCliente.solicitudRechazada;
  readonly posicionEnLista = this.etapaCliente.posicionEnLista;
  readonly estadoSolicitudMesa = estadoSolicitudMesa;

  readonly titulo = computed(() => {
    const etapa = this.etapa();
    return etapa?.tipo === 'estadia' ? `MESA ${etapa.solicitud.numero_mesa}` : 'BIENVENIDO';
  });

  readonly accionPrincipal = computed<AccionPrincipal | null>(() => {
    const etapa = this.etapa();
    switch (etapa?.tipo) {
      case 'sin-mesa':
        return 'escanear-entrada';
      case 'mesa-asignada':
        return 'escanear-mesa';
      case 'estadia':
        return etapa.pedido ? null : 'ver-menu';
      default:
        return null;
    }
  });

  constructor() {
    addIcons({
      qrCodeOutline,
      starOutline,
      timeOutline,
      syncOutline,
      chatbubblesOutline,
      receiptOutline,
      chevronForwardOutline,
      closeCircleOutline,
    });

    effect(() => {
      if (this.etapaCliente.enEstadia()) void this.avisoRechazo.vigilar();
    });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const [perfil] = await Promise.all([this.perfilActual.obtener(), this.etapaCliente.iniciar()]);
      this.perfil.set(perfil);
    } finally {
      this.loading.ocultar();
    }
  }

  ionViewWillEnter(): void {
    this.etapaCliente.mirandoInicio = true;
    if (this.etapa()) void this.etapaCliente.refrescar();
  }

  ionViewWillLeave(): void {
    this.etapaCliente.mirandoInicio = false;
  }

  escanearQrEntrada(): void {
    this.router.navigate(['/cliente-anonimo/escaneo-qr']);
  }

  escanearQrMesa(): void {
    this.router.navigate(['/cliente-anonimo/escaneo-mesa']);
  }

  // Hasta el menú unificado (issue 14), se pide desde armar-pedido.
  irAlMenu(): void {
    const etapa = this.etapa();
    if (etapa?.tipo !== 'estadia') return;
    this.router.navigate(['/mesa', etapa.solicitud.mesa_id, 'pedido'], {
      queryParams: { mesa: etapa.solicitud.numero_mesa },
    });
  }

  verPedido(): void {
    const etapa = this.etapa();
    if (etapa?.tipo !== 'estadia') return;
    this.router.navigate(['/mesa', etapa.solicitud.mesa_id, 'estado-pedido'], {
      queryParams: { mesa: etapa.solicitud.numero_mesa },
    });
  }

  consultarAlMozo(): void {
    const etapa = this.etapa();
    if (etapa?.tipo === 'estadia') this.router.navigate(['/consultas', etapa.solicitud.id]);
  }
}
