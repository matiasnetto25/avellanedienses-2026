import { Component, computed, inject } from '@angular/core';
import { PanelInicioComponent, AccionPanel } from '../../shared/components/panel-inicio/panel-inicio.component';
import { Auth } from '../../core/services/auth';
import { nombreCompleto } from '../../core/utils/nombre-completo';

@Component({
  selector: 'app-cantina',
  standalone: true,
  imports: [PanelInicioComponent],
  templateUrl: './cantina.page.html',
})
export class CantinaPage {
  private readonly sesion = inject(Auth).sesion;

  readonly nombre = computed(() => nombreCompleto(this.sesion() ?? { nombre: '' }));
  readonly foto = computed(() => this.sesion()?.foto ?? null);

  readonly acciones: AccionPanel[] = [
    { texto: 'Agregar bebida', ruta: '/cantina/agregar-bebida' },
    { texto: 'Ver comandas', ruta: '/cantina/comandas' },
  ];
}
