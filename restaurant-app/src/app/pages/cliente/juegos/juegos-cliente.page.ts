import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonContent, IonFooter, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircle, chevronBackOutline, closeCircle, discOutline, gameControllerOutline, layersOutline, lockClosedOutline, wineOutline } from 'ionicons/icons';
import {
  DESCUENTO_POR_ACIERTOS,
  PALOS,
  PaloCarta,
  ResultadoJuegoCarta,
  TipoCarta,
  VALORES_POR_TIPO,
  ValorCarta,
  etiquetaPalo,
  etiquetaValor,
  simboloPalo,
} from '../../../core/models/juego-carta.model';
import { JuegoRuletaComponent } from './ruleta/juego-ruleta.component';
import { JuegoSommelierComponent } from './sommelier/juego-sommelier.component';
import { EstadoJuegos, generaDescuento, motivoSinDescuento } from '../../../core/models/juegos-estado.model';
import { JuegosEstadoService } from '../../../core/services/juegos-estado.service';
import { AvisosService } from '../../../core/services/avisos.service';
import { JuegoCartaService } from '../../../core/services/juego-carta.service';
import { LoadingService } from '../../../core/services/loading.service';
import { PerfilActual, PerfilActualService } from '../../../core/services/perfil-actual.service';
import { BarraAccionesComponent } from '../../../shared/components/barra-acciones/barra-acciones.component';
import { EstadoVacioComponent } from '../../../shared/components/estado-vacio/estado-vacio.component';
import { AlturaDisponibleDirective } from '../../../shared/directives/altura-disponible.directive';

/** Juegos del cliente. Por ahora: «Adiviná la carta» (solo clientes registrados). */
@Component({
  selector: 'app-juegos-cliente',
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonFooter,
    IonIcon,
    AlturaDisponibleDirective,
    BarraAccionesComponent,
    EstadoVacioComponent,
    JuegoSommelierComponent,
    JuegoRuletaComponent,
  ],
  templateUrl: './juegos-cliente.page.html',
  styleUrls: ['./juegos-cliente.page.scss'],
})
export class JuegosClientePage implements OnInit {
  private readonly router = inject(Router);
  private readonly perfilActual = inject(PerfilActualService);
  private readonly juego = inject(JuegoCartaService);
  private readonly juegosEstado = inject(JuegosEstadoService);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);

  readonly perfil = signal<PerfilActual | null>(null);
  readonly cargando = signal(true);
  /** Pueden jugar el cliente registrado y el anónimo; solo el registrado obtiene descuento. */
  readonly puedeJugar = computed(() => {
    const tipo = this.perfil()?.tipo;
    return tipo === 'cliente' || tipo === 'cliente-anonimo';
  });
  readonly estadoJuegos = signal<EstadoJuegos | null>(null);

  /** Aviso de «Adiviná la carta» sobre el descuento (null si esta partida lo genera). */
  readonly avisoDescuento = computed(() => {
    const previo = this.resultado();
    if (previo) {
      return `Ya jugaste por tu descuento${previo.descuento > 0 ? ' (' + previo.descuento + '%)' : ''}. Podés seguir jugando, pero estas partidas no suman descuento.`;
    }
    const estado = this.estadoJuegos();
    if (generaDescuento(estado, 'carta')) return 'El primer juego en el que participás define el descuento de tu visita, ganes o pierdas. En los demás jugás sin descuento.';
    return motivoSinDescuento(estado, 'carta');
  });

  /** Frase del resultado de una partida de práctica. */
  readonly razonPractica = computed(() => {
    const oficial = this.resultado();
    if (oficial) {
      return `Solo la primera partida de la visita da descuento${oficial.descuento > 0 ? ' y la tuya te dio ' + oficial.descuento + '%.' : ' y la tuya no dio descuento.'}`;
    }
    return motivoSinDescuento(this.estadoJuegos(), 'carta') ?? 'Esta partida es de práctica.';
  });

  /** Juego abierto; null = menú de juegos. */
  readonly juegoActivo = signal<'carta' | 'sommelier' | 'ruleta' | null>(null);
  readonly juegos = [
    { id: 'carta', nombre: 'Adiviná la carta', detalle: 'Acertá palo, tipo y valor y ganá hasta 20 % de descuento.', icono: 'layers-outline', disponible: true },
    { id: 'sommelier', nombre: 'El Sommelier Perfecto', detalle: 'Serví tres copas con precisión y ganá hasta 20 % de descuento.', icono: 'wine-outline', disponible: true },
    { id: 'ruleta', nombre: 'Ruleta de la Suerte', detalle: 'Girá la ruleta y probá suerte para ganar un descuento.', icono: 'disc-outline', disponible: true },
  ] as const;

  abrir(id: string): void {
    void this.refrescarEstado();
    if (id === 'carta' || id === 'sommelier' || id === 'ruleta') this.juegoActivo.set(id);
  }

  /** Vuelve a consultar qué juego generó el descuento (cambia al jugar el primero). */
  async refrescarEstado(): Promise<void> {
    const perfil = this.perfil();
    if (perfil) this.estadoJuegos.set(await this.juegosEstado.obtener(perfil.id));
  }

  /** Sale de Juegos hacia el inicio del cliente (por si la barra de pestañas no está). */
  salir(): void {
    void this.router.navigateByUrl('/cliente/inicio');
  }

  volver(): void {
    this.juegoActivo.set(null);
    this.nuevaPartida();
  }

  /** Vuelve a la selección para otra partida (sin descuento si ya se usó el de la primera). */
  nuevaPartida(): void {
    this.ultimo.set(null);
    this.palo.set(null);
    this.tipo.set(null);
    this.valor.set(null);
  }

  readonly palos = PALOS;
  readonly premios = [1, 2, 3].map(aciertos => ({ aciertos, descuento: DESCUENTO_POR_ACIERTOS[aciertos] }));

  // Las tres elecciones del intento.
  readonly palo = signal<PaloCarta | null>(null);
  readonly tipo = signal<TipoCarta | null>(null);
  readonly valor = signal<ValorCarta | null>(null);

  /** Los valores dependen del tipo: con «Número» no hay J, Q ni K, y al revés. */
  readonly valoresDisponibles = computed<readonly ValorCarta[]>(() => {
    const tipo = this.tipo();
    return tipo ? VALORES_POR_TIPO[tipo] : [];
  });
  readonly completo = computed(() => this.palo() !== null && this.tipo() !== null && this.valor() !== null);

  readonly jugando = signal(false);
  /** La primera partida de la estadía (la única que da descuento), si ya se jugó. */
  readonly resultado = signal<ResultadoJuegoCarta | null>(null);
  /** El intento que se está mirando: oficial o de práctica. Con valor, no se puede cambiar nada. */
  readonly ultimo = signal<ResultadoJuegoCarta | null>(null);

  readonly simboloPalo = simboloPalo;
  readonly etiquetaPalo = etiquetaPalo;
  readonly etiquetaValor = etiquetaValor;

  readonly esRojo = (palo: PaloCarta) => palo === 'corazon' || palo === 'diamante';

  constructor() {
    addIcons({ checkmarkCircle, chevronBackOutline, closeCircle, discOutline, gameControllerOutline, layersOutline, lockClosedOutline, wineOutline });
  }

  async ngOnInit(): Promise<void> {
    try {
      const perfil = await this.perfilActual.obtener();
      this.perfil.set(perfil);
      if (perfil?.tipo === 'cliente' || perfil?.tipo === 'cliente-anonimo') {
        this.estadoJuegos.set(await this.juegosEstado.obtener(perfil.id));
        if (perfil.tipo === 'cliente') this.resultado.set(await this.juego.obtenerMiPartida(perfil.id));
      }
    } finally {
      this.cargando.set(false);
    }
  }

  elegirPalo(palo: PaloCarta): void {
    if (!this.jugando()) this.palo.set(palo);
  }

  elegirTipo(tipo: TipoCarta): void {
    if (this.jugando() || this.tipo() === tipo) return;
    this.tipo.set(tipo);
    // El valor elegido ya no sirve si cambió el tipo.
    this.valor.set(null);
  }

  elegirValor(valor: ValorCarta): void {
    if (!this.jugando()) this.valor.set(valor);
  }

  async confirmar(): Promise<void> {
    const perfil = this.perfil();
    const palo = this.palo();
    const tipo = this.tipo();
    const valor = this.valor();
    if (!perfil || this.jugando()) return;
    if (!palo || !tipo || !valor) {
      await this.avisos.advertencia('Elegí el palo, el tipo y el valor antes de confirmar.');
      return;
    }

    this.jugando.set(true);
    this.loading.mostrar();
    try {
      const respuesta = await this.juego.jugar(perfil.id, palo, tipo, valor);
      if (respuesta.resultado) {
        this.ultimo.set(respuesta.resultado);
        // Solo la primera partida es la oficial (la que da descuento).
        if (!respuesta.resultado.practica) this.resultado.set(respuesta.resultado);
        void this.refrescarEstado();
        return;
      }
      await this.avisos.error(respuesta.mensaje ?? 'No se pudo jugar. Intentá de nuevo.');
    } finally {
      this.jugando.set(false);
      this.loading.ocultar();
    }
  }

  /** Texto de cada condición del resultado, para explicar qué acertó. */
  filasResultado(r: ResultadoJuegoCarta): { clave: string; acerto: boolean; texto: string }[] {
    const tipoCarta = (v: ValorCarta) => (v === 'A' || v === 'J' || v === 'Q' || v === 'K' ? 'letra' : 'número');
    const tipoElegido = r.eleccion.tipo === 'letra' ? 'letra' : 'número';
    return [
      {
        clave: 'Palo',
        acerto: r.aciertos.palo,
        texto: `Elegiste ${etiquetaPalo(r.eleccion.palo).toLowerCase()} ${simboloPalo(r.eleccion.palo)}; la carta era ${etiquetaPalo(r.carta.palo).toLowerCase()} ${simboloPalo(r.carta.palo)}.`,
      },
      {
        clave: 'Tipo',
        acerto: r.aciertos.tipo,
        texto: `Elegiste ${tipoElegido}; la carta era ${tipoCarta(r.carta.valor)}.`,
      },
      {
        clave: 'Valor',
        acerto: r.aciertos.valor,
        texto: `Elegiste ${etiquetaValor(r.eleccion.valor)}; la carta era ${etiquetaValor(r.carta.valor)}.`,
      },
    ];
  }
}