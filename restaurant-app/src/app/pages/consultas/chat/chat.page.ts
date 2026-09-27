import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonTextarea,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline } from 'ionicons/icons';
import { Auth } from '../../../core/services/auth';
import { AvisosService } from '../../../core/services/avisos.service';
import { ClienteActualService } from '../../../core/services/cliente-actual.service';
import { SolicitudesMesaService } from '../../../core/services/solicitudes-mesa.service';
import { ConsultasService } from '../../../core/services/consultas.service';
import { LoadingService } from '../../../core/services/loading.service';
import { NotificacionesService } from '../../../core/services/notificaciones.service';
import { SonidosService } from '../../../core/services/sonidos.service';
import {
  ConversacionActiva,
  MAX_CARACTERES_MENSAJE,
  MensajeMesa,
  esDeCliente,
} from '../../../core/models/consulta.model';

/**
 * Quién está usando el chat:
 *  - cliente: el cliente vinculado a esta estadía.
 *  - mozo:    cualquier mozo activo (todos ven y responden todas las mesas).
 */
type RolChat = 'cliente' | 'mozo';

/**
 * Chat estilo WhatsApp de una estadía (punto 11). Sin guard: el cliente
 * anónimo no tiene sesión de Auth, así que la identidad se resuelve acá,
 * igual que en MesaPage.
 */
@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    IonBackButton,
    IonButton,
    IonButtons,
    IonContent,
    IonFooter,
    IonHeader,
    IonIcon,
    IonTextarea,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
})
export class ChatPage implements OnInit, OnDestroy {
  @ViewChild(IonContent) private readonly contenido?: IonContent;

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(Auth);
  private readonly avisos = inject(AvisosService);
  private readonly loading = inject(LoadingService);
  private readonly clienteActual = inject(ClienteActualService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly consultas = inject(ConsultasService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly sonidos = inject(SonidosService);

  readonly maxCaracteres = MAX_CARACTERES_MENSAJE;

  readonly cargando = signal(true);
  readonly rol = signal<RolChat | null>(null);
  readonly conversacion = signal<ConversacionActiva | null>(null);
  readonly mensajes = signal<MensajeMesa[]>([]);
  readonly texto = signal('');
  readonly enviando = signal(false);
  readonly rutaVolver = signal('/bienvenida');

  readonly puedeEnviar = computed(() => !this.enviando() && this.texto().trim().length > 0);

  private solicitudId = '';
  private empleadoId: number | null = null;
  private desuscribirse: (() => void) | null = null;

  constructor() {
    addIcons({ sendOutline });
  }

  async ngOnInit(): Promise<void> {
    this.loading.mostrar();
    try {
      this.solicitudId = this.route.snapshot.paramMap.get('solicitudId') ?? '';

      const habilitado = await this.resolverIdentidad();
      if (!habilitado) return;

      const conversacion = await this.consultas.obtenerConversacion(this.solicitudId);
      if (!conversacion) {
        await this.salir('Esta mesa ya no tiene un chat activo.');
        return;
      }
      this.conversacion.set(conversacion);

      const mensajes = await this.consultas.listar(this.solicitudId);
      if (mensajes === null) {
        await this.avisos.error('No se pudieron cargar los mensajes. Probá de nuevo.');
        return;
      }
      this.mensajes.set(mensajes);

      this.desuscribirse = this.consultas.suscribirse(this.solicitudId, (mensaje) => {
        // Suena solo lo que escribió el otro lado; el propio ya sonó al enviarlo.
        if (this.agregar(mensaje) && !this.esPropio(mensaje)) {
          this.sonidos.mensajeRecibido();
        }
      });
    } catch (error) {
      console.error('Error cargando el chat:', error);
      await this.avisos.error('No se pudo cargar el chat. Probá de nuevo.');
    } finally {
      this.cargando.set(false);
      this.loading.ocultar();
      this.bajarAlUltimo(0);
    }
  }

  ngOnDestroy(): void {
    this.desuscribirse?.();
  }

  /**
   * Decide si quien abre la pantalla puede usar este chat. Devuelve false
   * (y ya redirigió) si no puede.
   */
  private async resolverIdentidad(): Promise<boolean> {
    // Si la app arrancó directo en esta ruta (al tocar una push), la
    // sesión puede no estar restaurada todavía.
    if (!this.auth.sesion()) {
      await this.auth.restaurarSesion();
    }
    const sesion = this.auth.sesion();

    if (sesion) {
      if (sesion.estado !== 'On' || sesion.puesto !== 'mozo') {
        this.rutaVolver.set('/inicio');
        await this.salir('Solo los mozos pueden responder las consultas.');
        return false;
      }
      this.rol.set('mozo');
      this.empleadoId = sesion.id;
      this.rutaVolver.set('/consultas');
      return true;
    }

    this.rutaVolver.set(await this.clienteActual.rutaInicioCliente());
    const clienteId = await this.clienteActual.obtenerClienteIdActual();
    const solicitud = clienteId ? await this.solicitudesMesa.obtenerMiSolicitud(clienteId) : null;

    if (solicitud?.estado !== 'vinculado') {
      await this.salir('Necesitás tener una mesa asignada para consultar al mozo.');
      return false;
    }

    this.rutaVolver.set(`/mesa/${solicitud.mesa_id}`);

    if (solicitud.id !== this.solicitudId) {
      await this.salir('Ese chat no es de tu mesa.');
      return false;
    }

    this.rol.set('cliente');
    return true;
  }

  private async salir(mensaje: string): Promise<void> {
    await this.avisos.error(mensaje);
    this.router.navigate([this.rutaVolver()], { replaceUrl: true });
  }

  // ===== Mensajes =====

  esPropio(mensaje: MensajeMesa): boolean {
    return this.rol() === 'cliente'
      ? esDeCliente(mensaje)
      : mensaje.empleado_id === this.empleadoId;
  }

  /** «Mesa N» para el cliente, «Nombre Apellido» para el mozo. */
  autor(mensaje: MensajeMesa): string {
    return esDeCliente(mensaje) ? `Mesa ${mensaje.numero_mesa}` : mensaje.autor_nombre;
  }

  /**
   * Agrega un mensaje una sola vez (el propio llega también por Realtime).
   * Devuelve false si ya estaba.
   */
  private agregar(mensaje: MensajeMesa): boolean {
    if (this.mensajes().some((m) => m.id === mensaje.id)) return false;
    this.mensajes.update((lista) => [...lista, mensaje]);
    this.bajarAlUltimo();
    return true;
  }

  private bajarAlUltimo(duracionMs = 300): void {
    // Espera a que Angular pinte el mensaje nuevo antes de scrollear.
    setTimeout(() => this.contenido?.scrollToBottom(duracionMs));
  }

  // ===== Envío =====

  async enviar(): Promise<void> {
    const texto = this.texto();
    const errorValidacion = this.consultas.validarTexto(texto);
    if (errorValidacion) {
      await this.avisos.error(errorValidacion);
      return;
    }

    this.enviando.set(true);
    try {
      const resultado = this.rol() === 'mozo' && this.empleadoId !== null
        ? await this.consultas.enviarComoMozo(this.solicitudId, this.empleadoId, texto)
        : await this.consultas.enviarComoCliente(this.solicitudId, texto);

      if (!resultado.ok || !resultado.mensajeGuardado) {
        await this.avisos.error(resultado.mensaje ?? 'No se pudo enviar el mensaje.');
        return;
      }

      this.texto.set('');
      this.sonidos.mensajeEnviado();
      this.agregar(resultado.mensajeGuardado);
      this.notificar(resultado.mensajeGuardado);
    } finally {
      this.enviando.set(false);
    }
  }

  /**
   * Push después de guardar, sin esperarla: si falla, el mensaje igual
   * quedó en el chat (NotificacionesService ya atrapa sus errores).
   *  - Mensaje del cliente → a todos los mozos.
   *  - Respuesta de un mozo → al cliente de esta estadía.
   */
  private notificar(mensaje: MensajeMesa): void {
    if (esDeCliente(mensaje)) {
      this.notificaciones.avisarNuevaConsulta(mensaje);
    } else {
      this.notificaciones.avisarRespuestaConsulta(mensaje);
    }
  }
}
