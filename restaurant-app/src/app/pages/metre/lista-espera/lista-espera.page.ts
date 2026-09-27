import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
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
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';
import { AvisosService } from '../../../core/services/avisos.service';
import { ClienteAnonimoService } from '../../../core/services/cliente-anonimo.service';
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
  private readonly avisos = inject(AvisosService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly clientes = inject(ClientesService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  readonly etiquetaTipo = etiquetaTipo;

  readonly filas = signal<FilaListaEspera[]>([]);
  readonly cargandoLista = signal(true);
  readonly procesandoId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargar();
  }

  async cargar(): Promise<void> {
    this.cargandoLista.set(true);
    this.loading.mostrar();
    try {
      this.filas.set(await this.clienteAnonimo.listarListaEspera());
    } finally {
      this.cargandoLista.set(false);
      this.loading.ocultar();
    }  }

  urlFoto(nombreArchivo: string): string | null {
    return this.clientes.obtenerUrlFoto(nombreArchivo);
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
