import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';

/**
 * Lista que nunca muestra una tarjeta cortada: toma el alto que queda libre en
 * la pantalla y se queda con las tarjetas que entran ENTERAS. Si hay más, la
 * lista scrollea por dentro y el scroll se acomoda de a una tarjeta.
 * Se aplica al contenedor de las tarjetas (hijos directos), dentro de un ion-content.
 */
@Directive({
  selector: '[appFilasEnteras]',
  standalone: true,
})
export class FilasEnterasDirective implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ionContent = inject(IonContent, { optional: true });

  /** Espacio que se deja libre debajo de la lista (el relleno inferior de la pantalla). */
  private static readonly MARGEN_INFERIOR = 24;

  private observadorTamano: ResizeObserver | null = null;
  private observadorHijos: MutationObserver | null = null;
  private pendiente = 0;
  private readonly medirAhora = () => this.programar();

  ngAfterViewInit(): void {
    const contenido = this.host.nativeElement.closest('ion-content');
    this.observadorTamano = new ResizeObserver(this.medirAhora);
    if (contenido) this.observadorTamano.observe(contenido);
    this.observadorHijos = new MutationObserver(this.medirAhora);
    this.observadorHijos.observe(this.host.nativeElement, { childList: true });
    window.addEventListener('resize', this.medirAhora);
    this.programar();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.pendiente);
    this.observadorTamano?.disconnect();
    this.observadorHijos?.disconnect();
    window.removeEventListener('resize', this.medirAhora);
  }

  private programar(): void {
    cancelAnimationFrame(this.pendiente);
    this.pendiente = requestAnimationFrame(() => void this.medir());
  }

  private async medir(): Promise<void> {
    const lista = this.host.nativeElement;
    const scrollEl = await this.ionContent?.getScrollElement();
    const tarjetas = Array.from(lista.children) as HTMLElement[];
    if (!scrollEl || tarjetas.length === 0) return;

    // Se mide sin límite para conocer el alto natural de cada tarjeta.
    lista.style.maxHeight = 'none';
    lista.style.overflowY = 'visible';

    const arriba =
      lista.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop;
    const libre = scrollEl.clientHeight - arriba - FilasEnterasDirective.MARGEN_INFERIOR;
    const separacion = parseFloat(getComputedStyle(lista).rowGap) || 0;

    let cantidad = 0;
    let usado = 0;
    for (const tarjeta of tarjetas) {
      const siguiente = usado + (cantidad > 0 ? separacion : 0) + tarjeta.offsetHeight;
      if (siguiente > libre) break;
      usado = siguiente;
      cantidad++;
    }
    cantidad = Math.max(cantidad, 1);
    if (cantidad === 1) usado = tarjetas[0].offsetHeight;

    if (cantidad >= tarjetas.length) return; // entran todas: sin scroll interno

    lista.style.maxHeight = `${usado}px`;
    lista.style.overflowY = 'auto';
    lista.style.scrollSnapType = 'y mandatory';
    lista.style.overscrollBehavior = 'contain';
    for (const tarjeta of tarjetas) tarjeta.style.scrollSnapAlign = 'start';
  }
}