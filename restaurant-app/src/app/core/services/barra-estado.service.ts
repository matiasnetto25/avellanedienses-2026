import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

type ModoBarraEstado = 'encabezado' | 'normal';

/**
 * Colores de la barra de estado de Android (la de la hora y la batería).
 *
 * - 'encabezado': bordó con íconos claros, mientras se ve el encabezado de
 *   perfil. Lo maneja app-encabezado-perfil solo.
 * - 'normal': crema con íconos oscuros, en el resto de las pantallas.
 *
 * Desde Android 15 la app se dibuja detrás de la barra (edge-to-edge) y
 * setBackgroundColor ya no hace nada: el color lo pone lo que haya debajo
 * (el encabezado bordó o la barra superior crema). Igual se llama para los
 * celulares con Android más viejo. Los íconos (setStyle) sí se cambian en
 * todas las versiones.
 *
 * Los colores van escritos acá porque el plugin pide hex y no lee las
 * variables CSS: son --color-encabezado y --color-superficie.
 */
@Injectable({ providedIn: 'root' })
export class BarraEstadoService {
  private modoActual: ModoBarraEstado | null = null;

  usarEncabezado(): Promise<void> {
    return this.aplicar('encabezado', '#580C1F', Style.Dark);
  }

  usarNormal(): Promise<void> {
    return this.aplicar('normal', '#FFF9EC', Style.Light);
  }

  private async aplicar(modo: ModoBarraEstado, color: string, estilo: Style): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.modoActual === modo) return;
    this.modoActual = modo;

    try {
      // Style.Dark = fondo oscuro → íconos claros; Style.Light = al revés.
      await StatusBar.setStyle({ style: estilo });
      await StatusBar.setBackgroundColor({ color });
    } catch {
      // En Android 15+ setBackgroundColor puede no estar disponible: se ignora.
    }
  }
}
