import { Component, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../marca-header/marca-header.component';
import { SesionService } from '../../../core/services/sesion.service';

/**
 * Un botón del panel. Si tiene `ruta`, navega; si no, ejecuta `accion`.
 */
export interface AccionPanel {
  texto: string;
  ruta?: string;
  accion?: () => void;
}

/**
 * Pantalla de inicio compartida por todos los perfiles: barra superior con
 * la marca y los botones, y abajo la foto, el nombre y el puesto.
 *
 * Cada perfil solo declara sus datos y su lista de botones; el botón
 * «Cerrar sesión» lo agrega siempre el panel, al final.
 *
 *   <app-panel-inicio [nombre]="nombre()" puesto="Cocinero"
 *                     [foto]="foto()" [acciones]="acciones" />
 *
 * Contenido extra (por ejemplo, el cartel del cliente anónimo) se pasa
 * entre las etiquetas y se muestra dentro de la pantalla.
 */
@Component({
  selector: 'app-panel-inicio',
  standalone: true,
  imports: [IonContent, IonButton, MarcaHeaderComponent],
  templateUrl: './panel-inicio.component.html',
  styleUrls: ['./panel-inicio.component.scss'],
})
export class PanelInicioComponent {
  private readonly router = inject(Router);
  private readonly sesionService = inject(SesionService);

  readonly nombre = input.required<string>();
  readonly puesto = input.required<string>();
  readonly foto = input<string | null>(null);
  readonly acciones = input.required<AccionPanel[]>();

  /**
   * true cuando la pantalla resuelve su propio cierre de sesión (el
   * cliente anónimo, que borra su cuenta): en lugar de SesionService, el
   * panel emite (salir).
   */
  readonly cierrePropio = input(false);
  readonly salir = output<void>();

  ejecutar(accion: AccionPanel): void {
    if (accion.ruta) {
      this.router.navigateByUrl(accion.ruta);
    } else {
      accion.accion?.();
    }
  }

  cerrarSesion(): void {
    if (this.cierrePropio()) {
      this.salir.emit();
    } else {
      this.sesionService.cerrarSesion();
    }
  }
}
