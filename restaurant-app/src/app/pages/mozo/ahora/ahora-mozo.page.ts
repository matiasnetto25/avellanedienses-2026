import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { ConversacionActiva } from '../../../core/models/consulta.model';
import { LoadingService } from '../../../core/services/loading.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { ResumenMozoService } from '../../../core/services/resumen-mozo.service';
import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { FilaPedidoComponent } from '../../pedidos/mozo/components/fila-pedido/fila-pedido.component';

const FILAS_POR_BLOQUE = 3;

// Bloques que faltan, en orden de urgencia (lineamientos §2.3):
// «Piden la cuenta» va arriba de todo (puntos 21 y 22) y
// «Listos para entregar» va al final (punto 19).
@Component({
  selector: 'app-ahora-mozo',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    IonContent,
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

  readonly porConfirmar = this.resumenMozo.porConfirmar;
  readonly consultasSinResponder = this.resumenMozo.consultasSinResponder;
  readonly pedidos = computed(() => this.resumenMozo.pedidos().slice(0, FILAS_POR_BLOQUE));
  readonly consultas = computed(() => this.resumenMozo.sinResponder().slice(0, FILAS_POR_BLOQUE));
  readonly todoEnOrden = computed(() => this.porConfirmar() === 0 && this.consultasSinResponder() === 0);

  readonly resumen = computed(() => {
    const cifras: string[] = [];
    const pedidos = this.porConfirmar();
    const consultas = this.consultasSinResponder();
    if (pedidos > 0) cifras.push(`${pedidos} por confirmar`);
    if (consultas > 0) cifras.push(consultas === 1 ? '1 consulta' : `${consultas} consultas`);
    return cifras;
  });

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const [perfil] = await Promise.all([this.perfilActual.obtener(), this.resumenMozo.iniciar()]);
      this.perfil.set(perfil);
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  abrirConsulta(conversacion: ConversacionActiva): void {
    this.router.navigate(['/consultas', conversacion.solicitud_id]);
  }
}
