import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent } from '@ionic/angular/standalone';
import { MarcaHeaderComponent } from '../marca-header/marca-header.component';
import { AvatarPerfilComponent } from '../avatar-perfil/avatar-perfil.component';

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
 * Cada perfil solo declara sus datos y su lista de botones. «Cerrar sesión»
 * está en la hoja de perfil, que se abre desde el avatar de arriba a la
 * derecha (y resuelve sola el caso del cliente anónimo).
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
  imports: [IonContent, IonButton, MarcaHeaderComponent, AvatarPerfilComponent],
  templateUrl: './panel-inicio.component.html',
  styleUrls: ['./panel-inicio.component.scss'],
})
export class PanelInicioComponent {
  private readonly router = inject(Router);

  readonly nombre = input.required<string>();
  readonly puesto = input.required<string>();
  readonly foto = input<string | null>(null);
  readonly acciones = input.required<AccionPanel[]>();

  ejecutar(accion: AccionPanel): void {
    if (accion.ruta) {
      this.router.navigateByUrl(accion.ruta);
    } else {
      accion.accion?.();
    }
  }
}
