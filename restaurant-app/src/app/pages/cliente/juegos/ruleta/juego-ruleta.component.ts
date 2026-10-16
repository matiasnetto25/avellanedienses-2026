import { Component, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import { PREMIO_POR_SEGMENTO, ResultadoRuleta, SEGMENTOS_RULETA } from '../../../../core/models/juego-ruleta.model';
import { EstadoJuegos, generaDescuento, motivoSinDescuento } from '../../../../core/models/juegos-estado.model';
import { JuegosEstadoService } from '../../../../core/services/juegos-estado.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { JuegoRuletaService } from '../../../../core/services/juego-ruleta.service';
import { PerfilActualService } from '../../../../core/services/perfil-actual.service';

type Fase = 'cargando' | 'listo' | 'girando' | 'resultado';

const GRADOS = 360 / SEGMENTOS_RULETA;
const VUELTAS = 6;
const DURACION_MS = 5200;
const RADIO = 96;
const CENTRO = 100;

interface SegmentoVista {
  indice: number;
  premio: number;
  trazo: string;
  /** Giro del texto para que quede a lo largo del radio. */
  angulo: number;
  etiqueta: string;
  clase: string;
}

/** Juego «Ruleta de la Suerte». Se muestra dentro de la pestaña Juegos. */
@Component({
  selector: 'app-juego-ruleta',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './juego-ruleta.component.html',
  styleUrls: ['./juego-ruleta.component.scss'],
})
export class JuegoRuletaComponent implements OnInit, OnDestroy {
  private readonly perfilActual = inject(PerfilActualService);
  private readonly juego = inject(JuegoRuletaService);
  private readonly juegosEstado = inject(JuegosEstadoService);
  private readonly avisos = inject(AvisosService);

  /** El cliente quiere volver al menú de juegos. */
  readonly salir = output<void>();

  readonly fase = signal<Fase>('cargando');
  /** Giro acumulado del disco, en grados. */
  readonly rotacion = signal(0);
  /** Si es false el disco se coloca sin animar (al volver a entrar con un resultado ya guardado). */
  readonly animar = signal(false);
  readonly resultado = signal<ResultadoRuleta | null>(null);
  /** Giros de práctica (desde el segundo): sin premio y sin guardarse. */
  readonly practica = signal(false);
  /** El giro oficial de la visita. */
  readonly oficial = signal<ResultadoRuleta | null>(null);
  readonly estadoJuegos = signal<EstadoJuegos | null>(null);

  /** true si el primer giro de este juego define el descuento de la visita. */
  readonly daDescuento = computed(() => generaDescuento(this.estadoJuegos(), 'ruleta'));
  /** Aviso sobre el descuento, antes de girar. */
  readonly avisoIntro = computed(() =>
    this.daDescuento()
      ? 'El primer juego en el que participás define el descuento de tu visita, ganes o pierdas. En los demás jugás sin descuento.'
      : motivoSinDescuento(this.estadoJuegos(), 'ruleta')
  );
  /** Frase del resultado de un giro de práctica. */
  readonly razonPractica = computed(() => {
    const oficial = this.oficial();
    if (oficial) {
      return `Solo el primer juego de la visita da descuento${oficial.premio > 0 ? ' (el tuyo fue de ' + oficial.premio + '%).' : ' (el tuyo no dio premio).'}`;
    }
    return motivoSinDescuento(this.estadoJuegos(), 'ruleta') ?? 'Este giro es de práctica.';
  });

  readonly duracion = DURACION_MS;

  readonly segmentos: SegmentoVista[] = PREMIO_POR_SEGMENTO.map((premio, indice) => {
    const inicio = ((indice * GRADOS - 90) * Math.PI) / 180;
    const fin = (((indice + 1) * GRADOS - 90) * Math.PI) / 180;
    const p = (a: number) => `${(CENTRO + RADIO * Math.cos(a)).toFixed(2)} ${(CENTRO + RADIO * Math.sin(a)).toFixed(2)}`;
    return {
      indice,
      premio,
      trazo: `M${CENTRO} ${CENTRO} L${p(inicio)} A${RADIO} ${RADIO} 0 0 1 ${p(fin)} Z`,
      angulo: indice * GRADOS + GRADOS / 2,
      etiqueta: premio > 0 ? `${premio}%` : 'Perdiste',
      clase: premio === 10 ? 'seg--10' : premio === 15 ? 'seg--15' : premio === 20 ? 'seg--20' : indice % 2 ? 'seg--nada-a' : 'seg--nada-b',
    };
  });

  readonly premios = [
    { premio: 10, texto: '10%' },
    { premio: 15, texto: '15%' },
    { premio: 20, texto: '20%' },
  ];

  readonly giroDeshabilitado = computed(() => this.fase() !== 'listo');

  private clienteId: string | null = null;
  private temporizador: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    addIcons({ chevronBackOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      const perfil = await this.perfilActual.obtener();
      if (perfil?.tipo !== 'cliente' && perfil?.tipo !== 'cliente-anonimo') return;
      this.clienteId = perfil.id;
      this.estadoJuegos.set(await this.juegosEstado.obtener(perfil.id));
      const previo = perfil.tipo === 'cliente' ? await this.juego.obtenerMiGiro(perfil.id) : null;
      if (previo) {
        // Ya giró en esta visita: se muestra su resultado, con la ruleta ya detenida.
        this.oficial.set(previo);
        this.resultado.set(previo);
        this.rotacion.set(this.destino(previo.segmento, 0));
        this.fase.set('resultado');
        return;
      }
      // Sin descuento (invitado u otro juego ya lo definió): los giros son de práctica.
      this.practica.set(!this.daDescuento());
      this.fase.set('listo');
    } catch {
      this.practica.set(true);
      this.fase.set('listo');
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.temporizador);
  }

  async girar(): Promise<void> {
    if (this.fase() !== 'listo') return;
    this.fase.set('girando');

    let resultado: ResultadoRuleta;
    if (this.practica()) {
      const segmento = Math.floor(Math.random() * SEGMENTOS_RULETA);
      resultado = { segmento, premio: 0 };
      this.resultadoPractica = PREMIO_POR_SEGMENTO[segmento];
    } else {
      if (!this.clienteId) {
        this.fase.set('listo');
        return;
      }
      const r = await this.juego.girar(this.clienteId);
      if (!r.resultado) {
        await this.avisos.error(r.mensaje ?? 'No se pudo girar. Intentá de nuevo.');
        this.fase.set('listo');
        return;
      }
      resultado = r.resultado;
      this.oficial.set(r.resultado);
    }

    this.animar.set(true);
    this.rotacion.set(this.destino(resultado.segmento, this.rotacion()));
    this.temporizador = setTimeout(() => {
      this.resultado.set(resultado);
      this.fase.set('resultado');
    }, DURACION_MS + 100);
  }

  /** «Volver a girar»: giro de práctica (sin premio, sin guardarse). */
  volverAGirar(): void {
    if (this.fase() !== 'resultado') return;
    this.practica.set(true);
    this.resultado.set(null);
    this.fase.set('listo');
  }

  volver(): void {
    this.salir.emit();
  }

  /** Lo que habría salido en un giro de práctica (solo para mostrarlo). */
  resultadoPractica = 0;

  /**
   * Giro final del disco para que el segmento elegido quede bajo el indicador
   * fijo de arriba: varias vueltas completas más un pequeño desvío al azar dentro del segmento.
   */
  private destino(segmento: number, actual: number): number {
    const desvio = actual === 0 && !this.animar() ? 0 : (Math.random() - 0.5) * GRADOS * 0.6;
    const hasta = 360 - (segmento * GRADOS + GRADOS / 2) + desvio;
    const base = Math.floor(actual / 360) * 360;
    return base + 360 * (actual === 0 && !this.animar() ? 0 : VUELTAS) + hasta;
  }
}