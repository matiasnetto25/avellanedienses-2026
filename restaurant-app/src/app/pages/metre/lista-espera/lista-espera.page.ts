import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  IonContent,
  IonCard,
  IonCardContent,
  IonButton,
} from '@ionic/angular/standalone';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { EncabezadoPerfilComponent } from '../../../shared/components/encabezado-perfil/encabezado-perfil.component';
import { ListaEsperaService } from '../../../core/services/lista-espera.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { ETIQUETA_PUESTO } from '../../../core/models/empleado.model';
import { AvisosService } from '../../../core/services/avisos.service';
import { SolicitudesMesaService } from '../../../core/services/solicitudes-mesa.service';
import { ClientesService } from '../../../core/services/clientes.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { etiquetaTipo } from '../../../core/models/mesa.model';
import { FilaListaEspera } from '../../../core/models/solicitud-mesa.model';

@Component({
  selector: 'app-lista-espera',
  standalone: true,
  imports: [
    AlturaDisponibleDirective,
    CommonModule,
    EncabezadoPerfilComponent,
    IonContent,
    IonCard,
    IonCardContent,
    IonButton,
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
  protected readonly listaEspera = inject(ListaEsperaService);

  readonly etiquetaTipo = etiquetaTipo;
  // TODO(issue 26): "Metre" o "Maître" en pantalla.
  readonly titulo = ETIQUETA_PUESTO['metre'].toUpperCase();

  readonly filas = this.listaEspera.filas;
  readonly procesandoId = signal<string | null>(null);
  readonly perfil = signal<PerfilActual | null>(null);

  readonly resumen = computed(() => {
    const cantidad = this.listaEspera.enEspera();
    return cantidad > 0 ? [`${cantidad} en espera`] : ['Nadie en espera'];
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

  urlFoto(nombreArchivo: string): string | null {
    return this.clientes.obtenerUrlFoto(nombreArchivo);
  }

  async aceptar(fila: FilaListaEspera): Promise<void> {
    if (this.procesandoId()) return;
    this.procesandoId.set(fila.id);
    this.loading.mostrar();

    try {
      const resultado = await this.solicitudesMesa.aceptarSolicitud(fila.id);

      if (!resultado.ok) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo aceptar la solicitud.');
        await this.listaEspera.refrescar();
        return;
      }

      this.notificaciones.avisarMesaAsignada(fila.cliente_id);

      this.listaEspera.quitar(fila.id);
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
