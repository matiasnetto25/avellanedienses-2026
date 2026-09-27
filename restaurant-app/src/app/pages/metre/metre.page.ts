import { Component, computed, inject } from '@angular/core';
import { PanelInicioComponent, AccionPanel } from '../../shared/components/panel-inicio/panel-inicio.component';
import { Auth } from '../../core/services/auth';
import { AvisosService } from '../../core/services/avisos.service';
import { nombreCompleto } from '../../core/utils/nombre-completo';

@Component({
  selector: 'app-metre',
  standalone: true,
  imports: [PanelInicioComponent],
  templateUrl: './metre.page.html',
})
export class MetrePage {
  private readonly sesion = inject(Auth).sesion;
  private readonly avisos = inject(AvisosService);

  readonly nombre = computed(() => nombreCompleto(this.sesion() ?? { nombre: '' }));
  readonly foto = computed(() => this.sesion()?.foto ?? null);

  readonly acciones: AccionPanel[] = [
    { texto: 'Registrar cliente', ruta: '/registrar-cliente' },
    { texto: 'Asignar mesa', accion: () => this.avisos.proximamente() },
    { texto: 'Lista de espera', ruta: '/metre/lista-espera' },
  ];
}
