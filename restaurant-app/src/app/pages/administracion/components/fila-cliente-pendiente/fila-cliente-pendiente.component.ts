import { Component, computed, inject, input, signal } from '@angular/core';
import { IonButton } from '@ionic/angular/standalone';
import { ClienteRow } from '../../../../core/models/cliente.model';
import { AvisosService } from '../../../../core/services/avisos.service';
import { ClientesService } from '../../../../core/services/clientes.service';
import { ClientesPendientesService } from '../../../../core/services/clientes-pendientes.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { NotificacionesService } from '../../../../core/services/notificaciones.service';
import { estadoCliente } from '../../../../core/utils/estado-visual';
import { nombreCompleto } from '../../../../core/utils/nombre-completo';
import { ChipEstadoComponent } from '../../../../shared/components/chip-estado/chip-estado.component';

/** Fila compacta de un cliente pendiente, con Aprobar y Rechazar. La usan «Ahora» y Personal. */
@Component({
  selector: 'app-fila-cliente-pendiente',
  standalone: true,
  imports: [IonButton, ChipEstadoComponent],
  templateUrl: './fila-cliente-pendiente.component.html',
  styleUrls: ['./fila-cliente-pendiente.component.scss'],
})
export class FilaClientePendienteComponent {
  private readonly clientesService = inject(ClientesService);
  private readonly pendientes = inject(ClientesPendientesService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly notificaciones = inject(NotificacionesService);

  readonly cliente = input.required<ClienteRow>();

  readonly procesando = signal(false);
  readonly estado = estadoCliente('pendiente')!;
  readonly nombre = computed(() => nombreCompleto(this.cliente()));
  readonly foto = computed(() => this.clientesService.obtenerUrlFoto(this.cliente().foto));
  readonly iniciales = computed(() =>
    this.nombre().split(' ').filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('')
  );

  aprobar(): Promise<void> {
    return this.procesar(true);
  }

  rechazar(): Promise<void> {
    return this.procesar(false);
  }

  private async procesar(aprobar: boolean): Promise<void> {
    if (this.procesando()) return;
    const cliente = this.cliente();
    this.procesando.set(true);
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
      this.pendientes.quitar(cliente.id);
    } finally {
      this.procesando.set(false);
      this.loading.ocultar();
    }
  }
}
