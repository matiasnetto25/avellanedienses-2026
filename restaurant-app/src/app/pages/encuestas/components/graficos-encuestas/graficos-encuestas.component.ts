import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronDownOutline, chevronForwardOutline, starOutline } from 'ionicons/icons';
import { ChartConfiguration } from 'chart.js';
import { ResultadosEncuestas, SerieGrafico } from '../../../../core/models/encuesta.model';
import { EstadoVacioComponent } from '../../../../shared/components/estado-vacio/estado-vacio.component';
import { GraficoComponent } from '../grafico/grafico.component';

interface PantallaGrafico {
  titulo: string;
  frase: string;
  descripcion: string;
  config: ChartConfiguration;
}

/** Lee un token de theme/variables.scss (ya resuelto, sin var()). */
function token(nombre: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

/** «Excelente: 3, Buena: 1…», para el aria-label del canvas. */
function resumir(serie: SerieGrafico, unidad = ''): string {
  return serie.etiquetas.map((etiqueta, i) => `${etiqueta}: ${serie.valores[i]}${unidad}`).join(', ');
}

/**
 * Los cinco gráficos de resultados de las encuestas (punto 20, issue 04),
 * uno por pantalla, como pide la consigna. En carrusel horizontal (se pasa
 * deslizando o con los botones, y los puntos marcan la posición) o en
 * vertical, uno abajo del otro (ver «disposicion»).
 *
 * No consulta la base: recibe los resultados ya agregados
 * (EncuestasService.obtenerResultados). Lo usan el cliente y la pestaña
 * Estadísticas del dueño y del supervisor.
 *
 * Carrusel con scroll-snap de CSS: Ionic 8 ya no trae ion-slides y así no
 * hace falta sumar Swiper.
 */
@Component({
  selector: 'app-graficos-encuestas',
  standalone: true,
  imports: [IonButton, IonIcon, EstadoVacioComponent, GraficoComponent],
  templateUrl: './graficos-encuestas.component.html',
  styleUrls: ['./graficos-encuestas.component.scss'],
})
export class GraficosEncuestasComponent {
  readonly resultados = input.required<ResultadosEncuestas>();
  /**
   * carrusel: horizontal, con flechas y puntos (cliente).
   * vertical: uno abajo del otro, cada uno del alto de la pantalla y con
   * ajuste al deslizar (dueño y supervisor). Las dos cumplen «un gráfico por
   * pantalla», que es un requisito excluyente de la consigna.
   */
  readonly disposicion = input<'carrusel' | 'vertical'>('carrusel');
  readonly esVertical = computed(() => this.disposicion() === 'vertical');

  private readonly pista = viewChild<ElementRef<HTMLElement>>('pista');
  readonly actual = signal(0);

  readonly pantallas = computed<PantallaGrafico[]>(() => this.armarPantallas(this.resultados()));

  readonly totalTexto = computed(() => {
    const total = this.resultados().total;
    return total === 1 ? 'Basado en 1 encuesta' : `Basado en ${total} encuestas`;
  });

  constructor() {
    addIcons({ chevronBackOutline, chevronDownOutline, chevronForwardOutline, starOutline });
  }

  /** Al deslizar con el dedo: la pantalla más visible pasa a ser la actual. Solo el carrusel la usa. */
  alDeslizar(): void {
    if (this.esVertical()) return;
    const pista = this.pista()?.nativeElement;
    const ancho = pista ? this.anchoPantalla(pista) : 0;
    if (!pista || ancho === 0) return;
    this.actual.set(Math.round(pista.scrollLeft / ancho));
  }

  irA(indice: number): void {
    const pista = this.pista()?.nativeElement;
    if (!pista) return;
    const destino = Math.max(0, Math.min(indice, this.pantallas().length - 1));
    pista.scrollTo({ left: destino * this.anchoPantalla(pista), behavior: 'smooth' });
    this.actual.set(destino);
  }

  /** Ancho real de cada pantalla, con decimales (clientWidth los redondea). */
  private anchoPantalla(pista: HTMLElement): number {
    return pista.scrollWidth / this.pantallas().length;
  }

  private armarPantallas(r: ResultadosEncuestas): PantallaGrafico[] {
    const colores = [1, 2, 3, 4, 5].map((n) => token(`--color-grafico-${n}`));
    const [cereza, pizarra, salvia, ocre] = colores;
    const texto = token('--color-texto');
    const textoSecundario = token('--color-texto-secundario');
    const grilla = token('--color-borde-suave');
    const superficie = token('--color-superficie');
    const fuente = token('--fuente-ui');

    const tipografia = { family: fuente, size: 13 };
    const ejeCantidad = {
      beginAtZero: true,
      ticks: { precision: 0, color: textoSecundario, font: tipografia },
      grid: { color: grilla },
      border: { display: false },
    };
    const ejeCategorias = {
      // Rectas siempre: si no entran, se parten en líneas (ver la calificación).
      ticks: { color: texto, font: tipografia, autoSkip: false, maxRotation: 0, minRotation: 0 },
      grid: { display: false },
      border: { color: grilla },
    };
    const leyendaAbajo = {
      position: 'bottom' as const,
      labels: { color: texto, font: { ...tipografia, size: 14 }, padding: 16, usePointStyle: true },
    };
    const tooltip = { titleFont: tipografia, bodyFont: tipografia };
    const comun = { responsive: true, maintainAspectRatio: false, animation: { duration: 400 } };

    return [
      {
        titulo: 'Calificación general',
        frase: 'Cuántas estrellas nos dieron los clientes.',
        descripcion: `Gráfico de barras. ${resumir(r.calificacion)}.`,
        config: {
          type: 'bar',
          data: {
            // «1 estrella» en dos líneas: con las cinco en fila no entran en un celular.
            labels: r.calificacion.etiquetas.map((etiqueta) => etiqueta.split(' ')),
            datasets: [{ label: 'Encuestas', data: r.calificacion.valores, backgroundColor: cereza, borderRadius: 6 }],
          },
          options: {
            ...comun,
            plugins: { legend: { display: false }, tooltip },
            scales: { x: ejeCategorias, y: ejeCantidad },
          },
        },
      },
      {
        titulo: 'Atención del mozo',
        frase: 'Cómo calificaron la atención en el salón.',
        descripcion: `Gráfico de torta. ${resumir(r.atencionMozo)}.`,
        config: {
          type: 'pie',
          data: {
            labels: r.atencionMozo.etiquetas,
            // Excelente, Buena, Regular y Mala: de verde a rojo.
            datasets: [{ data: r.atencionMozo.valores, backgroundColor: [salvia, pizarra, ocre, cereza], borderColor: superficie, borderWidth: 2 }],
          },
          options: { ...comun, plugins: { legend: leyendaAbajo, tooltip } },
        },
      },
      {
        titulo: 'Limpieza del salón por semana',
        frase: 'Promedio semanal, de 0 a 10. Cada punto es una semana.',
        descripcion: `Gráfico de línea. ${resumir(r.limpiezaPorSemana, ' de 10')}.`,
        config: {
          type: 'line',
          data: {
            labels: r.limpiezaPorSemana.etiquetas,
            datasets: [{
              label: 'Promedio',
              data: r.limpiezaPorSemana.valores,
              borderColor: pizarra,
              backgroundColor: pizarra,
              pointRadius: 5,
              pointHoverRadius: 7,
              tension: 0.3,
            }],
          },
          options: {
            ...comun,
            plugins: { legend: { display: false }, tooltip },
            scales: {
              // offset: margen a los costados, así el primer y el último punto no quedan pegados al borde.
              x: { ...ejeCategorias, offset: true },
              y: { ...ejeCantidad, min: 0, max: 10, ticks: { ...ejeCantidad.ticks, stepSize: 2 } },
            },
          },
        },
      },
      {
        titulo: 'Lo que más se destacó',
        frase: 'Cuántas veces se marcó cada aspecto de la visita.',
        descripcion: `Gráfico de barras horizontales. ${resumir(r.aspectos)}.`,
        config: {
          type: 'bar',
          data: {
            labels: r.aspectos.etiquetas,
            datasets: [{ label: 'Veces', data: r.aspectos.valores, backgroundColor: salvia, borderRadius: 6 }],
          },
          options: {
            ...comun,
            indexAxis: 'y',
            plugins: { legend: { display: false }, tooltip },
            scales: { x: ejeCantidad, y: ejeCategorias },
          },
        },
      },
      {
        titulo: '¿Nos recomendarían?',
        frase: 'Si los clientes recomendarían el restaurante.',
        descripcion: `Gráfico de dona. ${resumir(r.recomendaria)}.`,
        config: {
          type: 'doughnut',
          data: {
            labels: r.recomendaria.etiquetas,
            datasets: [{ data: r.recomendaria.valores, backgroundColor: [salvia, cereza], borderColor: superficie, borderWidth: 2 }],
          },
          options: { ...comun, plugins: { legend: leyendaAbajo, tooltip } },
        },
      },
    ];
  }
}
