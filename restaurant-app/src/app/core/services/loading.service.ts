import { Injectable, signal } from '@angular/core';


@Injectable({ providedIn: 'root' })
export class LoadingService {
  private contador = 0;
  readonly visible = signal(false);

  mostrar(): void {
    this.contador++;
    this.visible.set(true);
  }

  ocultar(): void {
    this.contador = Math.max(0, this.contador - 1);
    if (this.contador === 0) {
      this.visible.set(false);
    }
  }

  /** Atajo: envuelve una promesa, mostrando/ocultando automáticamente. */
  async envolver<T>(promesa: Promise<T>): Promise<T> {
    this.mostrar();
    try {
      return await promesa;
    } finally {
      this.ocultar();
    }
  }
}