
import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';

import { ConversacionActiva } from '../../../core/models/consulta.model';
import { LoadingService } from '../../../core/services/loading.service';
import {
  PerfilActual,
  PerfilActualService,
} from '../../../core/services/perfil-actual.service';
import { ResumenMozoService } from '../../../core/services/resumen-mozo.service';

import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { FilaPedidoComponent } from '../../pedidos/mozo/components/fila-pedido/fila-pedido.component';

const FILAS_POR_BLOQUE = 3;

@Component({
  selector: 'app-ahora-mozo',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    IonContent,
    IonIcon,
    AlturaDisponibleDirective,
    EncabezadoPerfilComponent,
    EstadoVacioComponent,
    FilaPedidoComponent,
  ],
  templateUrl: './ahora-mozo.page.html',
  styleUrls: ['./ahora-mozo.page.scss'],
})
export class AhoraMozoPage implements OnInit {
  private readonly router = inject(Router);
  private readonly loading = inject(LoadingService);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly resumenMozo = inject(ResumenMozoService);

  readonly cargando = signal(true);
  readonly perfil = signal<PerfilActual | null>(null);

  // Evita enviar varias solicitudes de entrega simultáneamente.
  readonly entregandoPedidoId = signal<string | null>(null);

  // Pedidos nuevos que esperan confirmación del mozo.
  readonly porConfirmar = this.resumenMozo.porConfirmar;

  readonly pedidos = computed(() =>
    this.resumenMozo.pedidos().slice(0, FILAS_POR_BLOQUE)
  );

  // Pedidos confirmados cuyos productos ya están todos listos.
  readonly cantidadListos = this.resumenMozo.cantidadListosParaEntregar;

  readonly pedidosListos = computed(() =>
    this.resumenMozo.pedidosListos().slice(0, FILAS_POR_BLOQUE)
  );

  // Consultas de clientes que esperan respuesta.
  readonly consultasSinResponder =
    this.resumenMozo.consultasSinResponder;

  readonly consultas = computed(() =>
    this.resumenMozo.sinResponder().slice(0, FILAS_POR_BLOQUE)
  );

  readonly todoEnOrden = computed(
    () =>
      this.porConfirmar() === 0 &&
      this.consultasSinResponder() === 0 &&
      this.cantidadListos() === 0
  );

  readonly resumen = computed(() => {
    const cifras: string[] = [];
    const pedidosPendientes = this.porConfirmar();
    const consultasPendientes = this.consultasSinResponder();
    const listos = this.cantidadListos();

    if (pedidosPendientes > 0) {
      cifras.push(`${pedidosPendientes} por confirmar`);
    }

    if (consultasPendientes > 0) {
      cifras.push(
        consultasPendientes === 1
          ? '1 consulta'
          : `${consultasPendientes} consultas`
      );
    }

    if (listos > 0) {
      cifras.push(
        listos === 1
          ? '1 listo para entregar'
          : `${listos} listos para entregar`
      );
    }

    return cifras;
  });

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();

    try {
      const [perfil] = await Promise.all([
        this.perfilActual.obtener(),
        this.resumenMozo.iniciar(),
      ]);

      this.perfil.set(perfil);
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  abrirConsulta(conversacion: ConversacionActiva): void {
    this.router.navigate(['/consultas', conversacion.solicitud_id]);
  }

  /**
   * Registra la entrega del pedido mediante ResumenMozoService.
   * El servicio quita el pedido de la lista solo si Supabase confirma
   * que la operación fue exitosa.
   */
  async entregarPedido(pedidoId: string): Promise<void> {
    if (this.entregandoPedidoId() !== null) {
      return;
    }

    this.entregandoPedidoId.set(pedidoId);

    try {
      await this.resumenMozo.entregarPedido(pedidoId);
    } catch (error: unknown) {
      console.error('Error al entregar el pedido:', error);
    } finally {
      this.entregandoPedidoId.set(null);
    }
  }
}
