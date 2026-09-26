import { Injectable } from '@angular/core';

/**
 * Sonidos del chat de consultas (punto 11). Se precargan una sola vez y
 * se rebobinan antes de cada reproducción, así dos mensajes seguidos
 * suenan los dos.
 *
 * Igual que el sonido de cierre de sesión (ver Auth): si el navegador o
 * el WebView bloquea la reproducción, se ignora — nunca rompe el flujo.
 */
@Injectable({ providedIn: 'root' })
export class SonidosService {
  private readonly enviado = this.crear('assets/sounds/mensaje-enviado.wav');
  private readonly recibido = this.crear('assets/sounds/mensaje-recibido.wav');

  mensajeEnviado(): void {
    this.reproducir(this.enviado);
  }

  mensajeRecibido(): void {
    this.reproducir(this.recibido);
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

  private reproducir(audio: HTMLAudioElement | null): void {
    if (!audio) return;
    try {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Reproducción bloqueada por el navegador/WebView — no es crítico.
      });
    } catch {
      // Ídem.
    }
  }
}
