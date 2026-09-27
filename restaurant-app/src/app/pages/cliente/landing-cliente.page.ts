import { Component, OnInit, inject, signal } from '@angular/core';
import { PanelInicioComponent, AccionPanel } from '../../shared/components/panel-inicio/panel-inicio.component';
import { AvisosService } from '../../core/services/avisos.service';
import { ClientesService } from '../../core/services/clientes.service';
import { nombreCompleto } from '../../core/utils/nombre-completo';

@Component({
  selector: 'app-landing-cliente',
  standalone: true,
  imports: [PanelInicioComponent],
  templateUrl: './landing-cliente.page.html',
})
export class LandingClientePage implements OnInit {
  private readonly clientesService = inject(ClientesService);
  private readonly avisos = inject(AvisosService);

  readonly nombre = signal('');
  readonly foto = signal<string | null>(null);

  readonly acciones: AccionPanel[] = [
    { texto: 'Menú', accion: () => this.avisos.proximamente() },
    { texto: 'Mis pedidos', accion: () => this.avisos.proximamente() },
    { texto: 'Encuestas', accion: () => this.avisos.proximamente() },
  ];

  async ngOnInit(): Promise<void> {
    const cliente = await this.clientesService.obtenerClienteActual();
    if (!cliente) return;

    this.nombre.set(nombreCompleto(cliente));
    this.foto.set(this.clientesService.obtenerUrlFoto(cliente.foto));
  }
}
