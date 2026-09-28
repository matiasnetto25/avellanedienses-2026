import { AfterViewInit, Component, ElementRef, OnDestroy, inject, input } from '@angular/core';
import { AvatarPerfilComponent } from '../avatar-perfil/avatar-perfil.component';
import { BarraEstadoService } from '../../../core/services/barra-estado.service';
import { NOMBRE_APP } from '../../../core/identidad-app';

/**
 * Encabezado de perfil (guía §7.7): el bloque bordó de la PRIMERA pestaña de
 * cada perfil (Ahora, Mi mesa, Lista de espera, Inicio del cliente). El resto
 * de las pestañas usa la barra superior crema con app-avatar-perfil.
 *
 * Va DENTRO del ion-content, como primer elemento (no en un ion-header),
 * para que se desplace con el contenido. El ion-content no lleva padding
 * (nada de class="ion-padding"): el encabezado va de borde a borde.
 *
 *   <ion-content class="densidad-compacta">
 *     <app-encabezado-perfil
 *       [saludo]="'Hola, ' + perfil()?.nombre"
 *       titulo="MOZO"
 *       [nombre]="perfil()?.nombre ?? ''"
 *       [foto]="perfil()?.foto ?? null"
 *       [resumen]="['2 por confirmar', '1 consulta']" />
 *     …
 *   </ion-content>
 *
 * Nombre y foto salen de PerfilActualService.obtener().
 *
 * Mientras la pantalla que lo contiene está a la vista, la barra de estado de
 * Android pasa a bordó con íconos claros; al salir, vuelve a crema.
 */
@Component({
  selector: 'app-encabezado-perfil',
  standalone: true,
  imports: [AvatarPerfilComponent],
  templateUrl: './encabezado-perfil.component.html',
  styleUrls: ['./encabezado-perfil.component.scss'],
})
export class EncabezadoPerfilComponent implements AfterViewInit, OnDestroy {
  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly barraEstado = inject(BarraEstadoService);

  /** Por ejemplo "Hola, Sofía". */
  readonly saludo = input.required<string>();
  /** El contexto, en mayúsculas: "MOZO", "MESA 4", "COCINA". */
  readonly titulo = input.required<string>();
  readonly nombre = input.required<string>();
  readonly foto = input<string | null>(null);
  /** Cifras de "Ahora" (2 o 3), por ejemplo ['2 por confirmar', '1 consulta']. */
  readonly resumen = input<string[]>([]);

  readonly marca = NOMBRE_APP.toUpperCase();

  /** La pantalla (ion-page) que contiene al encabezado. */
  private pagina: HTMLElement | null = null;

  // Ionic avisa en el elemento de la pantalla cuándo entra y cuándo sale
  // (también al cambiar de pestaña o al ir a una pantalla de detalle).
  private readonly alEntrar = () => void this.barraEstado.usarEncabezado();
  private readonly alSalir = () => void this.barraEstado.usarNormal();

  ngAfterViewInit(): void {
    this.pagina = this.elemento.nativeElement.closest('.ion-page');
    this.pagina?.addEventListener('ionViewWillEnter', this.alEntrar);
    this.pagina?.addEventListener('ionViewWillLeave', this.alSalir);

    // La primera vez, la pantalla puede haber entrado antes de que el
    // encabezado se anotara a los eventos.
    if (!this.pagina?.classList.contains('ion-page-hidden')) {
      this.alEntrar();
    }
  }

  ngOnDestroy(): void {
    this.pagina?.removeEventListener('ionViewWillEnter', this.alEntrar);
    this.pagina?.removeEventListener('ionViewWillLeave', this.alSalir);
    this.alSalir();
  }
}
