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
import { LoadingService } from '../../../core/services/loading.service';
import { ResumenMozoService } from '../../../core/services/resumen-mozo.service';
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
  private readonly loading = inject(LoadingService);
  private readonly resumen = inject(ResumenMozoService);
  private readonly sonidos = inject(SonidosService);

  readonly cargando = signal(true);
  readonly conversaciones = this.resumen.conversaciones;

  private readonly dejarDeEscuchar = this.resumen.alRecibirMensaje((mensaje) => this.alNuevoMensaje(mensaje));

  /**
   * Ionic mantiene viva esta pantalla mientras el mozo está dentro de un
   * chat: sin esto, cada mensaje sonaría dos veces.
   */
  private visible = false;

  async ngOnInit(): Promise<void> {
    try {
      await this.loading.envolver(this.resumen.iniciar());
    } finally {
      this.cargando.set(false);
    }
  }

  /** Al volver de un chat, refresca por si se respondió desde ahí. */
  async ionViewWillEnter(): Promise<void> {
    this.visible = true;
    if (!this.cargando()) await this.resumen.recargarConversaciones();
  }

  ionViewWillLeave(): void {
    this.visible = false;
  }

  ngOnDestroy(): void {
    this.dejarDeEscuchar();
  }

  private alNuevoMensaje(mensaje: MensajeMesa): void {
    if (this.visible && esDeCliente(mensaje)) {
      this.sonidos.mensajeRecibido();
    }
  }

  abrir(conversacion: ConversacionActiva): void {
    this.router.navigate(['/consultas', conversacion.solicitud_id]);
  }
}
