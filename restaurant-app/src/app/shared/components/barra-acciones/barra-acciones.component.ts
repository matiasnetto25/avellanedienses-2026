import { Component } from '@angular/core';

/**
 * Barra de acciones fija (guía §7.2): el contenedor al pie de la pantalla
 * donde viven la acción principal y las secundarias. Solo estilos, sin lógica.
 *
 * Va SIEMPRE dentro de ion-footer, que es lo que Ionic mantiene fijo abajo,
 * sobre el teclado y la zona segura:
 *
 *   <ion-footer class="ion-no-border">
 *     <app-barra-acciones>
 *       <ion-button class="accion-secundaria" expand="block">Volver a sacar la foto</ion-button>
 *       <ion-button class="accion-principal" expand="block" (click)="onSubmit()">Ingresar</ion-button>
 *       <ion-button class="accion-destructiva" expand="block">Cancelar registro</ion-button>
 *     </app-barra-acciones>
 *   </ion-footer>
 *
 * Orden de los botones: se apilan en el orden en que se escriben en el HTML.
 * La convención es secundarias arriba, la principal (una sola) debajo, al
 * alcance del pulgar, y la destructiva, si hay, al final como texto.
 *
 * Formularios: el ion-footer queda FUERA del <form>, así que un botón
 * type="submit" dentro de la barra NO envía el formulario. Dos opciones:
 *   1. (click)="onSubmit()" en el botón (la más simple), o
 *   2. id en el form y el atributo form en el botón:
 *        <form id="form-login" [formGroup]="form" (ngSubmit)="onSubmit()">…</form>
 *        <ion-button type="submit" form="form-login">Ingresar</ion-button>
 *
 * En pantallas con barra de pestañas, la barra de acciones queda encima de
 * las pestañas (el ion-footer de la página ya se ubica ahí).
 */
@Component({
  selector: 'app-barra-acciones',
  standalone: true,
  template: '<ng-content />',
  styleUrls: ['./barra-acciones.component.scss'],
})
export class BarraAccionesComponent {}
