import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ModalController } from '@ionic/angular';

/**
 * Avatar del usuario: su foto o, si no tiene (o no carga), sus iniciales.
 * Al tocarlo abre la hoja de perfil (guía §7.9), que tiene «Cerrar sesión».
 *
 * Dónde va:
 * - En el encabezado de perfil (primera pestaña): lo pone solo
 *   app-encabezado-perfil, con la variante sobreEncabezado.
 * - En la barra superior de las demás pestañas, a la derecha:
 *
 *     <ion-header class="ion-no-border">
 *       <ion-toolbar>
 *         <ion-title>Consultas</ion-title>
 *         <app-avatar-perfil slot="end" [nombre]="perfil()?.nombre ?? ''" [foto]="perfil()?.foto ?? null" />
 *       </ion-toolbar>
 *     </ion-header>
 *
 *   Nombre y foto salen de PerfilActualService.obtener().
 *
 * La zona tocable mide 44px aunque el círculo sea de 36px.
 */
@Component({
  selector: 'app-avatar-perfil',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './avatar-perfil.component.html',
  styleUrls: ['./avatar-perfil.component.scss'],
})
export class AvatarPerfilComponent {
  private readonly modalController = inject(ModalController);

  /** Nombre completo: da las iniciales y el aria-label. */
  readonly nombre = input.required<string>();
  /** URL de la foto, o null para mostrar las iniciales. */
  readonly foto = input<string | null>(null);
  /** Diámetro del círculo en px: 36 en barras y encabezado, 72 en la hoja. */
  readonly tamano = input(36);
  /** Borde floral white para que se despegue del fondo bordó. */
  readonly sobreEncabezado = input(false);
  /** false dentro de la hoja de perfil: ahí solo se muestra, no abre nada. */
  readonly tocable = input(true);

  /** true si la foto falló al cargar: se muestran las iniciales. */
  readonly fotoRota = signal(false);

  readonly iniciales = computed(() =>
    this.nombre()
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((palabra) => palabra.charAt(0).toUpperCase())
      .join('')
  );

  constructor() {
    // Si cambia la foto (por ejemplo, llega después de cargar el perfil),
    // se vuelve a intentar mostrarla.
    effect(() => {
      this.foto();
      this.fotoRota.set(false);
    });
  }

  async abrirHoja(): Promise<void> {
    // Import dinámico: la hoja usa este mismo avatar (en 72px), y si los dos
    // archivos se importaran entre sí de forma directa quedaría un ciclo.
    const { HojaPerfilComponent } = await import('../hoja-perfil/hoja-perfil.component');

    const hoja = await this.modalController.create({
      component: HojaPerfilComponent,
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      handle: true,
      cssClass: 'hoja-perfil',
      componentProps: { nombre: this.nombre(), foto: this.foto() },
    });
    await hoja.present();
  }
}
