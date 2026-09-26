import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonBadge,
  IonButton,
} from '@ionic/angular/standalone';
import { Auth } from '../../core/services/auth';
import { MesasService } from '../../core/services/mesas.service';
import { LoadingService } from '../../core/services/loading.service';
import { AvisosService } from '../../core/services/avisos.service';
import { ClienteActualService } from '../../core/services/cliente-actual.service';
import { ClienteAnonimoService } from '../../core/services/cliente-anonimo.service';
import { MesaRow, etiquetaTipo } from '../../core/models/mesa.model';
import { PUESTOS_VISTA_MESA } from '../../core/models/empleado.model';

/**
 * Qué se muestra en la pantalla, según quién la abre:
 *  - staff:       metre/mozo/dueño/supervisor → información de la mesa.
 *  - cliente:     cliente vinculado a ESTA mesa → sus opciones de la estadía.
 *  - otraMesa:    cliente vinculado a OTRA mesa → se le indica cuál es la suya.
 *  - sinMesa:     cliente sin mesa vinculada → no puede usar esta mesa.
 *  - sinPermiso:  empleado cuyo puesto no ve información de mesas.
 */
type VistaMesa = 'staff' | 'cliente' | 'otraMesa' | 'sinMesa' | 'sinPermiso';

@Component({
  selector: 'app-mesa',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonBadge,
    IonButton,
  ],
  templateUrl: './mesa.page.html',
  styleUrls: ['./mesa.page.scss'],
})
export class MesaPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly mesasService = inject(MesasService);
  private readonly loading = inject(LoadingService);
  private readonly avisos = inject(AvisosService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);

  readonly etiquetaTipo = etiquetaTipo;

  readonly cargando = signal(true);
  readonly mesa = signal<MesaRow | null>(null);
  readonly noEncontrada = signal(false);
  readonly vista = signal<VistaMesa | null>(null);

  /** Mesa a la que realmente está vinculado el cliente (solo en la vista 'otraMesa'). */
  readonly miMesa = signal<{ id: string; numero: number } | null>(null);

  /** A dónde vuelve el botón atrás: panel del empleado o pantalla principal del cliente. */
  readonly rutaVolver = signal('/bienvenida');

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      const idMesa = this.route.snapshot.paramMap.get('idMesa');
      const mesa = idMesa ? await this.mesasService.obtenerPorId(idMesa) : null;

      if (!mesa) {
        this.noEncontrada.set(true);
        return;
      }
      this.mesa.set(mesa);

      await this.resolverVista(mesa);
    } catch (error) {
      console.error('Error cargando la mesa:', error);
      await this.avisos.error('No se pudo cargar la mesa. Probá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  private async resolverVista(mesa: MesaRow): Promise<void> {
    // Si la app arrancó directo en esta ruta (por ejemplo, al tocar una
    // push), app.component puede no haber terminado de restaurar la
    // sesión todavía: sin esto, un mozo se vería como "cliente sin mesa".
    if (!this.auth.sesion()) {
      await this.auth.restaurarSesion();
    }
    const sesion = this.auth.sesion();

    if (sesion) {
      this.rutaVolver.set('/inicio');
      const puedeVer = sesion.estado === 'On' && (PUESTOS_VISTA_MESA as string[]).includes(sesion.puesto);
      this.vista.set(puedeVer ? 'staff' : 'sinPermiso');
      return;
    }

    this.rutaVolver.set(await this.clienteActual.rutaInicioCliente());

    const clienteId = await this.clienteActual.obtenerClienteIdActual();
    const solicitud = clienteId ? await this.clienteAnonimo.obtenerMiSolicitud(clienteId) : null;

    if (solicitud?.estado !== 'vinculado') {
      this.vista.set('sinMesa');
      return;
    }

    if (solicitud.mesa_id !== mesa.id) {
      this.miMesa.set({ id: solicitud.mesa_id, numero: solicitud.numero_mesa });
      this.vista.set('otraMesa');
      return;
    }

    this.vista.set('cliente');
  }

  urlFoto(mesa: MesaRow): string | null {
    return this.mesasService.obtenerUrlFoto(mesa.foto);
  }

  irAMiMesa(): void {
    const miMesa = this.miMesa();
    if (miMesa) {
      this.router.navigate(['/mesa', miMesa.id], { replaceUrl: true });
    }
  }

  volverAlInicio(): void {
    this.router.navigate([this.rutaVolver()], { replaceUrl: true });
  }

  async proximamente(): Promise<void> {
    await this.avisos.info('Esta función se habilita en la próxima entrega.');
  }
}
