import { Component, ElementRef, OnDestroy, afterNextRender, effect, input, viewChild } from '@angular/core';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  ChartConfiguration,
  DoughnutController,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip,
} from 'chart.js';

// Solo las piezas de Chart.js que usan los gráficos de encuestas: el resto
// queda fuera del bundle.
Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PieController,
  PointElement,
  Tooltip
);

/**
 * Un gráfico de Chart.js sobre un <canvas> (punto 20, issue 04). Recibe la
 * configuración completa y la redibuja cuando cambia. Sin ng2-charts: con
 * Angular 20 pediría sumar @angular/cdk solo para esto.
 *
 * El alto lo define el contenedor (maintainAspectRatio: false en la config).
 */
@Component({
  selector: 'app-grafico',
  standalone: true,
  template: `<canvas #lienzo role="img" [attr.aria-label]="descripcion()"></canvas>`,
  styles: `
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class GraficoComponent implements OnDestroy {
  readonly config = input.required<ChartConfiguration>();
  /** Resumen del gráfico para lectores de pantalla. */
  readonly descripcion = input.required<string>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private grafico: Chart | null = null;
  private renderizado = false;

  constructor() {
    // El canvas existe recién después del primer render.
    afterNextRender(() => {
      this.renderizado = true;
      this.dibujar(this.config());
    });
    effect(() => {
      const config = this.config();
      if (this.renderizado) this.dibujar(config);
    });
  }

  ngOnDestroy(): void {
    this.grafico?.destroy();
  }

  private dibujar(config: ChartConfiguration): void {
    this.grafico?.destroy();
    this.grafico = new Chart(this.lienzo().nativeElement, config);
  }
}
