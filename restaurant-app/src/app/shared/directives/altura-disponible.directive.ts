import { AfterViewInit, Directive, ElementRef, OnDestroy, inject, input } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

/**
 * Para las listas que muestran un elemento por «página» ocupando todo el
 * alto de la pantalla (ver-mesas, lista-espera, solicitudes, gestión de
 * mesas y la carta). Mide el alto real del área de scroll de ion-content y lo deja
 * en la variable CSS --altura-disponible, que usan los .scss.
 *
 *   <ion-content appAlturaDisponible> … </ion-content>
 *   <ion-content appAlturaDisponible [margenAltura]="64"> … </ion-content>
 *
 * Se mide con JS porque los porcentajes de CSS no se propagan de forma
 * confiable a través del Shadow DOM de ion-content. Vuelve a medir al
 * entrar a la pantalla (también al volver a una ya abierta), al rotar o
 * redimensionar, y cuando cambia el tamaño de ion-content.
 */
@Directive({
  selector: 'ion-content[appAlturaDisponible]',
  standalone: true,
})
export class AlturaDisponibleDirective implements AfterViewInit, OnDestroy {
  private readonly ionContent = inject(IonContent);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /**
   * Píxeles a restar además de la franja de gestos: el padding de la lista
   * más un margen de seguridad para redondeos entre dispositivos.
   */
  readonly margenAltura = input(48);

  /** false para usar el alto completo, sin restar la franja de gestos (la carta). */
  readonly descontarBarraGestos = input(true);

  private pagina: HTMLElement | null = null;
  private observador: ResizeObserver | null = null;
  private readonly medirAhora = () => this.medir();

  ngAfterViewInit(): void {
    // Ionic dispara ionViewDidEnter como evento DOM sobre la página cuando
    // termina la transición de entrada, también al volver a ella.
    this.pagina = this.host.nativeElement.closest('.ion-page');
    this.pagina?.addEventListener('ionViewDidEnter', this.medirAhora);
    window.addEventListener('resize', this.medirAhora);

    this.observador = new ResizeObserver(this.medirAhora);
    this.observador.observe(this.host.nativeElement);

    requestAnimationFrame(this.medirAhora);
  }

  ngOnDestroy(): void {
    this.pagina?.removeEventListener('ionViewDidEnter', this.medirAhora);
    window.removeEventListener('resize', this.medirAhora);
    this.observador?.disconnect();
  }

  private async medir(): Promise<void> {
    const scrollEl = await this.ionContent.getScrollElement();
    const alturaTotal = scrollEl.clientHeight;
    if (!alturaTotal) return;

    const gestos = this.descontarBarraGestos() ? this.safeAreaBottom() : 0;
    const altura = alturaTotal - this.margenAltura() - gestos;
    scrollEl.style.setProperty('--altura-disponible', `${altura}px`);
  }

  /**
   * Alto real (en px) de env(safe-area-inset-bottom): la franja que ocupan
   * los botones de gestos de Android. clientHeight de ion-content NO la
   * descuenta sola; sin restarla, el último botón de la card queda tapado
   * por los botones del sistema.
   */
  private safeAreaBottom(): number {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.bottom = '0';
    div.style.visibility = 'hidden';
    div.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    document.body.appendChild(div);
    const valor = parseFloat(getComputedStyle(div).paddingBottom) || 0;
    document.body.removeChild(div);
    return valor;
  }
}
