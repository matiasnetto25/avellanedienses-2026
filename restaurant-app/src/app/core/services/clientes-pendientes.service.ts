import { Injectable, computed, inject, signal } from '@angular/core';
import { Auth } from './auth';
import { ClientesService } from './clientes.service';
import { ClienteRow } from '../models/cliente.model';

/** Una sola suscripción de Realtime para «Ahora», Personal y el contador de la pestaña. */
@Injectable({ providedIn: 'root' })
export class ClientesPendientesService {
  private readonly clientes = inject(ClientesService);

  private readonly _filas = signal<ClienteRow[]>([]);
  readonly filas = this._filas.asReadonly();
  readonly cantidad = computed(() => this._filas().length);
  readonly cargada = signal(false);

  private desuscribir: (() => void) | null = null;

  constructor() {
    inject(Auth).alCerrarSesion(async () => this.detener());
  }

  iniciar(): void {
    if (this.desuscribir) return;
    this.desuscribir = this.clientes.observarClientes(() => void this.refrescar());
    void this.refrescar();
  }

  async refrescar(): Promise<void> {
    this._filas.set(await this.clientes.listarPendientes());
    this.cargada.set(true);
  }

  quitar(id: string): void {
    this._filas.update(lista => lista.filter(c => c.id !== id));
  }

  private detener(): void {
    this.desuscribir?.();
    this.desuscribir = null;
    this._filas.set([]);
    this.cargada.set(false);
  }
}
