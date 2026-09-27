import { Component, computed, inject } from '@angular/core';
import { PanelInicioComponent, AccionPanel } from '../../shared/components/panel-inicio/panel-inicio.component';
import { Auth } from '../../core/services/auth';
import { nombreCompleto } from '../../core/utils/nombre-completo';

@Component({
  selector: 'app-administracion',
  standalone: true,
  imports: [PanelInicioComponent],
  templateUrl: './administracion.page.html',
})
export class AdministracionPage {
  private readonly sesion = inject(Auth).sesion;

  readonly nombre = computed(() => nombreCompleto(this.sesion() ?? { nombre: '' }));
  readonly foto = computed(() => this.sesion()?.foto ?? null);
  /** Dueño o supervisor (el panel lo muestra en mayúsculas). */
  readonly puesto = computed(() => this.sesion()?.puesto ?? '');

  readonly acciones: AccionPanel[] = [
    { texto: 'Administración del personal', ruta: '/administracion/personal' },
    { texto: 'Crear mesa', ruta: '/administracion/salon/crear' },
    { texto: 'Gestión de mesas', ruta: '/administracion/salon/gestion' },
    { texto: 'Solicitudes de clientes', ruta: '/administracion/solicitudes' },
  ];
}
