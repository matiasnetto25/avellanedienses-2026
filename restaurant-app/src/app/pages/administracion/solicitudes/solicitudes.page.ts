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
import { ClientesService } from '../../../core/services/clientes.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { LoadingService } from '../../../core/services/loading.service';
import { ClienteRow } from '../../../core/models/cliente.model';

@Component({
  selector: 'app-solicitudes-clientes',
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
  templateUrl: './solicitudes.page.html',
  styleUrls: ['./solicitudes.page.scss'],
})
export class SolicitudesClientesPage implements OnInit {
  private readonly avisos = inject(AvisosService);
  private readonly clientesService = inject(ClientesService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);

  readonly clientes = signal<ClienteRow[]>([]);
  readonly cargandoLista = signal(true);
  readonly procesandoId = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.cargarPendientes();
  }

  async cargarPendientes(): Promise<void> {
    this.cargandoLista.set(true);
    this.loading.mostrar();
    try {
      this.clientes.set(await this.clientesService.listarPendientes());
    } finally {
      this.cargandoLista.set(false);
      this.loading.ocultar();
    }  }

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

      this.notificaciones.avisarClienteRevisado(cliente.nombre, cliente.apellido, aprobar);

      this.clientes.update((lista) => lista.filter((c) => c.id !== cliente.id));
    } finally {
      this.procesandoId.set(null);
      this.loading.ocultar();
    }
  }
}
