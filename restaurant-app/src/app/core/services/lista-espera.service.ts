import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { SolicitudesMesaService } from './solicitudes-mesa.service';
import { FilaListaEspera } from '../models/solicitud-mesa.model';

/** Una sola suscripción de Realtime para la lista del metre y el contador de su pestaña. */
@Injectable({ providedIn: 'root' })
export class ListaEsperaService {
  private readonly solicitudesMesa = inject(SolicitudesMesaService);

  private readonly _filas = signal<FilaListaEspera[]>([]);
  readonly filas = this._filas.asReadonly();
  readonly enEspera = computed(() => this._filas().length);
  readonly cargada = signal(false);

  private desuscribir: (() => void) | null = null;

  constructor() {
    inject(Auth).alCerrarSesion(async () => this.detener());
  }

  iniciar(): void {
    if (this.desuscribir) return;
    this.desuscribir = this.solicitudesMesa.observarListaEspera(() => void this.refrescar());
    void this.refrescar();
  }

  async refrescar(): Promise<void> {
    this._filas.set(await this.solicitudesMesa.listarListaEspera());
    this.cargada.set(true);
  }

  quitar(id: string): void {
    this._filas.update(lista => lista.filter(f => f.id !== id));
  }

  private detener(): void {
    this.desuscribir?.();
    this.desuscribir = null;
    this._filas.set([]);
    this.cargada.set(false);
  }
}
