import { Component, OnDestroy, OnInit, computed, inject, output, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, chevronBackOutline, closeCircle } from 'ionicons/icons';
import {
  CopaSommelier,
  DESCUENTO_POR_COPAS,
  PartidaSommelier,
  ResultadoCopa,
  SOMMELIER_COPAS,
  SOMMELIER_MS_MAXIMO,
  SOMMELIER_PORCENTAJE_POR_MS,
  SOMMELIER_TOLERANCIA,
} from '../../../../core/models/juego-sommelier.model';
import { EstadoJuegos, generaDescuento, motivoSinDescuento } from '../../../../core/models/juegos-estado.model';
import { JuegosEstadoService } from '../../../../core/services/juegos-estado.service';
import { AvisosService } from '../../../../core/services/avisos.service';
import { JuegoSommelierService } from '../../../../core/services/juego-sommelier.service';
import { LoadingService } from '../../../../core/services/loading.service';
import { PerfilActualService } from '../../../../core/services/perfil-actual.service';

type Fase = 'cargando' | 'intro' | 'listo' | 'sirviendo' | 'enviando' | 'copa' | 'final';

// Geometría de la copa (viewBox 0 0 200 160): el vino va de y = 124 (0 %) a y = 14 (100 %).
const Y_BASE = 124;
const ALTO_VINO = 110;

/** Juego «El Sommelier Perfecto». Se muestra dentro de la pestaña Juegos. */
@Component({
  selector: 'app-juego-sommelier',
  standalone: true,
  imports: [IonIcon],
  templateUrl: './juego-sommelier.component.html',
  styleUrls: ['./juego-sommelier.component.scss'],
})
export class JuegoSommelierComponent implements OnInit, OnDestroy {
  private readonly perfilActual = inject(PerfilActualService);
  private readonly juego = inject(JuegoSommelierService);
  private readonly juegosEstado = inject(JuegosEstadoService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  /** El cliente quiere volver al menú de juegos. */
  readonly salir = output<void>();

  readonly fase = signal<Fase>('cargando');
  readonly partida = signal<PartidaSommelier | null>(null);
  /** Nivel del vino en la copa que se está sirviendo (0 a 100). */
  readonly nivel = signal(0);
  /** Resultado de la copa recién servida. */
  readonly ultimaCopa = signal<CopaSommelier | null>(null);
  /** Partida de práctica (desde la segunda): se juega en el celular, sin descuento y sin guardarse. */
  readonly practica = signal(false);
  /** La partida oficial de la visita (la que dio, o no, el descuento). */
  readonly oficial = signal<PartidaSommelier | null>(null);
  readonly estadoJuegos = signal<EstadoJuegos | null>(null);

  /** true si la primera partida de este juego define el descuento de la visita. */
  readonly daDescuento = computed(() => generaDescuento(this.estadoJuegos(), 'sommelier'));
  /** Aviso de la pantalla de inicio. */
  readonly avisoIntro = computed(() =>
    this.daDescuento()
      ? 'El primer juego en el que participás define el descuento de tu visita, ganes o pierdas. En los demás jugás sin descuento.'
      : motivoSinDescuento(this.estadoJuegos(), 'sommelier')
  );
  /** Frase del resultado de una partida de práctica. */
  readonly razonPractica = computed(() => {
    const oficial = this.oficial();
    if (oficial) {
      return `Solo la primera partida de la visita da descuento${(oficial.descuento ?? 0) > 0 ? ' y la tuya te dio ' + oficial.descuento + '%.' : ' y la tuya no dio descuento.'}`;
    }
    return motivoSinDescuento(this.estadoJuegos(), 'sommelier') ?? 'Esta partida es de práctica.';
  });
  private objetivosPractica: number[] = [];

  readonly copas = [1, 2, 3];
  readonly premios = [1, 2, 3].map(copas => ({ copas, descuento: DESCUENTO_POR_COPAS[copas] }));
  readonly tolerancia = SOMMELIER_TOLERANCIA;

  /** Número de la copa en juego (1 a 3). */
  readonly copaActual = computed(() => {
    const p = this.partida();
    if (!p) return 1;
    const ultima = this.ultimaCopa();
    return Math.min(SOMMELIER_COPAS, ultima ? ultima.numero : p.copasServidas + 1);
  });

  readonly objetivo = computed(() => this.ultimaCopa()?.objetivo ?? this.partida()?.objetivoActual ?? 0);
  readonly nivelTexto = computed(() => Math.round(this.nivel()));

  // Geometría del vino y de la marca del objetivo dentro de la copa.
  readonly vinoY = computed(() => Y_BASE - (ALTO_VINO * this.nivel()) / 100);
  readonly vinoAlto = computed(() => (ALTO_VINO * this.nivel()) / 100);
  readonly objetivoY = computed(() => Y_BASE - (ALTO_VINO * this.objetivo()) / 100);
  readonly bandaY = computed(() => Y_BASE - (ALTO_VINO * Math.min(100, this.objetivo() + SOMMELIER_TOLERANCIA)) / 100);
  readonly bandaAlto = computed(() => {
    const arriba = Math.min(100, this.objetivo() + SOMMELIER_TOLERANCIA);
    const abajo = Math.max(0, this.objetivo() - SOMMELIER_TOLERANCIA);
    return (ALTO_VINO * (arriba - abajo)) / 100;
  });

  readonly mensajeCopa = computed(() => {
    const c = this.ultimaCopa();
    return c ? MENSAJES[c.resultado] : null;
  });

  readonly esUltima = computed(() => this.partida()?.estado === 'finalizada');
  readonly descuentoFinal = computed(() => this.partida()?.descuento ?? 0);

  private clienteId: string | null = null;
  private inicio = 0;
  private cuadro = 0;

  constructor() {
    addIcons({ checkmarkCircle, chevronBackOutline, closeCircle });
  }

  async ngOnInit(): Promise<void> {
    try {
      const perfil = await this.perfilActual.obtener();
      if (perfil?.tipo !== 'cliente' && perfil?.tipo !== 'cliente-anonimo') return;
      this.clienteId = perfil.id;
      this.estadoJuegos.set(await this.juegosEstado.obtener(perfil.id));
      const partida = perfil.tipo === 'cliente' ? await this.juego.obtenerMiPartida(perfil.id) : null;
      this.partida.set(partida);
      this.fase.set(!partida ? 'intro' : partida.estado === 'finalizada' ? 'final' : 'listo');
    } catch {
      this.fase.set('intro');
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.cuadro);
  }

  async comenzar(): Promise<void> {
    if (!this.clienteId || this.fase() !== 'intro') return;
    // Sin descuento (invitado u otro juego ya lo definió): se juega de práctica, sin pasar por la base.
    if (!this.daDescuento()) {
      this.volverAJugar();
      return;
    }
    this.loading.mostrar();
    try {
      const r = await this.juego.iniciar(this.clienteId);
      if (!r.ok || !r.partida) {
        await this.avisos.error(r.mensaje ?? 'No se pudo empezar la partida.');
        return;
      }
      this.partida.set(r.partida);
      this.nivel.set(0);
      this.fase.set(r.partida.estado === 'finalizada' ? 'final' : 'listo');
    } finally {
      this.loading.ocultar();
    }
  }

  // ----------------------------- vertido -----------------------------

  empezarVertido(evento: Event): void {
    if (this.fase() !== 'listo') return;
    const e = evento as PointerEvent;
    try {
      (e.currentTarget as Element | null)?.setPointerCapture?.(e.pointerId);
    } catch {
      /* sin captura: igual se detiene al soltar o salir del botón */
    }
    this.inicio = performance.now();
    this.nivel.set(0);
    this.fase.set('sirviendo');
    this.cuadro = requestAnimationFrame(() => this.avanzar());
  }

  private avanzar(): void {
    if (this.fase() !== 'sirviendo') return;
    const ms = Math.min(performance.now() - this.inicio, SOMMELIER_MS_MAXIMO);
    this.nivel.set(Math.min(100, ms * SOMMELIER_PORCENTAJE_POR_MS));
    // Al llegar al borde de la copa se detiene solo.
    if (ms >= SOMMELIER_MS_MAXIMO) {
      void this.terminarVertido();
      return;
    }
    this.cuadro = requestAnimationFrame(() => this.avanzar());
  }

  async terminarVertido(): Promise<void> {
    if (this.fase() !== 'sirviendo' || !this.clienteId) return;
    cancelAnimationFrame(this.cuadro);
    const ms = Math.min(Math.round(performance.now() - this.inicio), SOMMELIER_MS_MAXIMO);
    this.nivel.set(Math.min(100, ms * SOMMELIER_PORCENTAJE_POR_MS));
    this.fase.set('enviando');

    if (this.practica()) {
      this.servirPractica(ms);
      return;
    }

    const r = await this.juego.servir(this.clienteId, this.copaActual(), ms);
    if (r.ok && r.copa && r.partida) {
      this.nivel.set(r.copa.nivel);
      this.ultimaCopa.set(r.copa);
      this.partida.set(r.partida);
      this.fase.set('copa');
      return;
    }
    // La copa no quedó registrada en el servidor: se vuelve a ofrecer la misma.
    if (r.partida) this.partida.set(r.partida);
    await this.avisos.error(r.mensaje ?? 'No se pudo registrar la copa. Intentá de nuevo.');
    this.nivel.set(0);
    this.fase.set(r.partida?.estado === 'finalizada' ? 'final' : 'listo');
  }

  /** Evalúa una copa de práctica con las mismas reglas, sin tocar la base de datos. */
  private servirPractica(ms: number): void {
    const p = this.partida();
    if (!p) return;
    const nivel = Math.min(100, Math.round(ms * SOMMELIER_PORCENTAJE_POR_MS * 10) / 10);
    const numero = p.copasServidas + 1;
    const objetivo = this.objetivosPractica[numero - 1];
    const resultado: ResultadoCopa =
      Math.abs(nivel - objetivo) <= SOMMELIER_TOLERANCIA ? 'perfecto' : nivel < objetivo ? 'corto' : 'pasado';
    const copa: CopaSommelier = { numero, objetivo, nivel, resultado };
    const copas = [...p.copas, copa];
    const terminada = numero === SOMMELIER_COPAS;
    const aciertos = copas.filter(c => c.resultado === 'perfecto').length;
    this.nivel.set(nivel);
    this.ultimaCopa.set(copa);
    this.partida.set({
      estado: terminada ? 'finalizada' : 'en_curso',
      copasServidas: numero,
      objetivoActual: terminada ? null : this.objetivosPractica[numero],
      aciertos: terminada ? aciertos : null,
      descuento: 0,
      copas,
    });
    this.fase.set('copa');
  }

  /** «Volver a jugar»: nueva partida de práctica (sin descuento). */
  volverAJugar(): void {
    const actual = this.partida();
    if (!this.practica() && actual?.estado === 'finalizada') this.oficial.set(actual);
    this.objetivosPractica = this.copas.map(() => 50 + Math.floor(Math.random() * 51));
    this.practica.set(true);
    this.ultimaCopa.set(null);
    this.nivel.set(0);
    this.partida.set({
      estado: 'en_curso',
      copasServidas: 0,
      objetivoActual: this.objetivosPractica[0],
      aciertos: null,
      descuento: 0,
      copas: [],
    });
    this.fase.set('listo');
  }

  siguiente(): void {
    this.ultimaCopa.set(null);
    this.nivel.set(0);
    this.fase.set(this.partida()?.estado === 'finalizada' ? 'final' : 'listo');
  }

  volver(): void {
    this.salir.emit();
  }

  teclaAbajo(evento: Event): void {
    const e = evento as KeyboardEvent;
    if (e.repeat) return;
    e.preventDefault();
    this.empezarVertido(e);
  }

  teclaArriba(evento: Event): void {
    evento.preventDefault();
    void this.terminarVertido();
  }

  /** Estado de la copa `n` en los puntos de progreso. */
  estadoPunto(n: number): 'hecha' | 'actual' | 'pendiente' {
    const servidas = this.partida()?.copasServidas ?? 0;
    if (n <= servidas) return 'hecha';
    return n === servidas + 1 ? 'actual' : 'pendiente';
  }

  resultadoDe(n: number): ResultadoCopa | null {
    return this.partida()?.copas.find(c => c.numero === n)?.resultado ?? null;
  }
}

const MENSAJES: Record<ResultadoCopa, { titulo: string; tono: 'ok' | 'corto' | 'pasado' }> = {
  perfecto: { titulo: '¡Perfecto!', tono: 'ok' },
  corto: { titulo: 'Te quedaste corto', tono: 'corto' },
  pasado: { titulo: '¡Te pasaste!', tono: 'pasado' },
};