import { Component, computed, inject } from '@angular/core';
import { PanelInicioComponent, AccionPanel } from '../../shared/components/panel-inicio/panel-inicio.component';
import { Auth } from '../../core/services/auth';
import { AvisosService } from '../../core/services/avisos.service';
import { nombreCompleto } from '../../core/utils/nombre-completo';

@Component({
  selector: 'app-cocina',
  standalone: true,
  imports: [PanelInicioComponent],
  templateUrl: './cocina.page.html',
})
export class CocinaPage {
  private readonly sesion = inject(Auth).sesion;
  private readonly avisos = inject(AvisosService);

  readonly nombre = computed(() => nombreCompleto(this.sesion() ?? { nombre: '' }));
  readonly foto = computed(() => this.sesion()?.foto ?? null);

  readonly acciones: AccionPanel[] = [
    { texto: 'Agregar plato', ruta: '/cocina/agregar-plato' },
    { texto: 'Ver comandas', accion: () => this.avisos.proximamente() },
  ];
}
