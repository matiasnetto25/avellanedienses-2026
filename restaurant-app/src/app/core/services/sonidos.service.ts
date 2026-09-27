import { Injectable } from '@angular/core';

/** Único lugar con las rutas de los sonidos: cambiar un archivo es cambiar una línea. */
const SONIDOS = {
  apertura: 'assets/sounds/apertura.mp3',
  cierreSesion: 'assets/sounds/cierre.mp3',
  mensajeEnviado: 'assets/sounds/mensaje-enviado.wav',
  mensajeRecibido: 'assets/sounds/mensaje-recibido.wav',
} as const;

type Sonido = keyof typeof SONIDOS;

/**
 * Único servicio que reproduce sonidos en la app: apertura (splash),
 * cierre de sesión y los del chat de consultas (punto 11).
 *
 * Los audios se precargan una sola vez y se rebobinan antes de cada
 * reproducción, así dos mensajes seguidos suenan los dos.
 *
 * Si el navegador o el WebView bloquea la reproducción (por ejemplo,
 * Chrome no deja reproducir audio antes de que el usuario toque la
 * página), se avisa por consola y se sigue: nunca rompe el flujo.
 * En Android, Capacitor permite el autoplay.
 */
@Injectable({ providedIn: 'root' })
export class SonidosService {
  private readonly audios = new Map<Sonido, HTMLAudioElement | null>();

  constructor() {
    for (const sonido of Object.keys(SONIDOS) as Sonido[]) {
      this.audios.set(sonido, this.crear(SONIDOS[sonido]));
    }
  }

  apertura(): void {
    this.reproducir('apertura');
  }

  cierreSesion(): void {
    this.reproducir('cierreSesion');
  }

  mensajeEnviado(): void {
    this.reproducir('mensajeEnviado');
  }

  mensajeRecibido(): void {
    this.reproducir('mensajeRecibido');
  }

  private crear(ruta: string): HTMLAudioElement | null {
    try {
      const audio = new Audio(ruta);
      audio.preload = 'auto';
      return audio;
    } catch {
      return null;
    }
  }

  private reproducir(sonido: Sonido): void {
    const audio = this.audios.get(sonido);
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch((error: unknown) => {
        console.warn(`No se pudo reproducir el sonido "${sonido}":`, error);
      });
    } catch (error) {
      console.warn(`No se pudo reproducir el sonido "${sonido}":`, error);
    }
  }
}
