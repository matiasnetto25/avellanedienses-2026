import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AvisosService } from '../../../core/services/avisos.service';
import { ConsultasService } from '../../../core/services/consultas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { SonidosService } from '../../../core/services/sonidos.service';
import { ConversacionActiva, MensajeMesa, esDeCliente } from '../../../core/models/consulta.model';

/**
 * Lista de conversaciones del mozo (punto 11): una por estadía vinculada.
 * Todos los mozos ven todas las mesas y cualquiera puede responder.
 */
@Component({
  selector: 'app-conversaciones',
  standalone: true,
  imports: [
    DatePipe,
    IonBadge,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonNote,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './conversaciones.page.html',
  styleUrls: ['./conversaciones.page.scss'],
})
export class ConversacionesPage implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly consultas = inject(ConsultasService);
  private readonly sonidos = inject(SonidosService);

  readonly cargando = signal(true);
  readonly conversaciones = signal<ConversacionActiva[]>([]);

  private desuscribirse: (() => void) | null = null;

  /**
   * Ionic mantiene viva esta pantalla (y su suscripción) mientras el mozo
   * está dentro de un chat: sin esto, cada mensaje sonaría dos veces.
   */
  private visible = false;

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      await this.cargar();
      this.desuscribirse = this.consultas.suscribirse(null, (mensaje) => this.alNuevoMensaje(mensaje));
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
    }
  }

  /** Al volver de un chat, refresca por si se respondió desde ahí. */
  async ionViewWillEnter(): Promise<void> {
    this.visible = true;
    if (!this.cargando()) await this.cargar();
  }

  ionViewWillLeave(): void {
    this.visible = false;
  }

  ngOnDestroy(): void {
    this.desuscribirse?.();
  }

  private async cargar(): Promise<void> {
    const conversaciones = await this.consultas.listarConversaciones();
    if (conversaciones === null) {
      await this.avisos.error('No se pudieron cargar las conversaciones. Probá de nuevo.');
      return;
    }
    this.conversaciones.set(conversaciones);
  }

  /** Sube la conversación del mensaje nuevo arriba de todo y actualiza su extracto. */
  private async alNuevoMensaje(mensaje: MensajeMesa): Promise<void> {
    if (this.visible && esDeCliente(mensaje)) {
      this.sonidos.mensajeRecibido();
    }

    const actual = this.conversaciones().find((c) => c.solicitud_id === mensaje.solicitud_id);
    if (!actual) {
      // Una estadía que no estaba en la lista (se vinculó después de cargarla).
      await this.cargar();
      return;
    }

    const actualizada: ConversacionActiva = {
      ...actual,
      ultimo_texto: mensaje.texto,
      ultimo_created_at: mensaje.created_at,
      sin_responder: esDeCliente(mensaje),
    };
    this.conversaciones.update((lista) => [
      actualizada,
      ...lista.filter((c) => c.solicitud_id !== mensaje.solicitud_id),
    ]);
  }

  abrir(conversacion: ConversacionActiva): void {
    this.router.navigate(['/consultas', conversacion.solicitud_id]);
  }
}
