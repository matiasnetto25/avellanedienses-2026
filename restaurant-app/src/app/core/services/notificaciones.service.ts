import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Preferences } from '@capacitor/preferences';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { SupabaseService } from './supabase.service';
import { Auth } from './auth';
import { Puesto } from '../models/empleado.model';
import { MensajeMesa } from '../models/consulta.model';

const CLAVE_CLIENTE_ANONIMO_ID = 'merlot_cliente_anonimo_id';
/** Largo máximo del texto del chat que se muestra en la push. */
const MAX_CARACTERES_EXTRACTO = 80;

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly toastController = inject(ToastController);

  private inicializado = false;

  /**
   * Cachea el último token que nos dio Firebase. El evento "registration"
   * solo se dispara UNA vez, en el momento del register() (que ocurre al
   * arrancar la app, en app.component.ts) — pero en ese momento todavía
   * NO hay sesión de empleado (el login pasa después). Por eso el token
   * se guarda acá y se reintenta guardar en Supabase cada vez que SÍ hay
   * sesión: ver guardarTokenPendienteSiHaySesion(), llamado desde login.
   */
  private ultimoToken: string | null = null;

  constructor() {
    // Cualquier cierre de sesión (botón o expiración a la hora) borra el
    // token: si no, el dispositivo seguía recibiendo las push de alguien
    // que ya no tiene sesión en él.
    this.auth.alCerrarSesion(() => this.eliminarToken());
  }

  /**
   * Llamar UNA sola vez al bootstrapear la app (ej: en app.component.ts,
   * justo después de auth.restaurarSesion()). Pide permiso, se registra
   * en FCM/APNs y deja armados los listeners para app abierta y cerrada.
   */
  async inicializar(): Promise<void> {
    if (this.inicializado) return;
    this.inicializado = true;

    try {
      let permiso = await PushNotifications.checkPermissions();
      if (permiso.receive === 'prompt') {
        permiso = await PushNotifications.requestPermissions();
      }
      if (permiso.receive !== 'granted') {
        console.warn('Permiso de notificaciones push no otorgado.');
        return;
      }

      await PushNotifications.register();

      // Se dispara UNA sola vez, cuando el SO nos da el token del
      // dispositivo — normalmente antes de que exista sesión todavía.
      PushNotifications.addListener('registration', (token: Token) => {
        this.ultimoToken = token.value;
        this.asignarTokenDelDispositivo(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error registrando para push notifications:', error);
      });

      // APP ABIERTA (foreground): el sistema operativo NO muestra la
      // notificación solo — hay que mostrarla nosotros manualmente.
      // Se usa un toast propio (no avisos.info(), que va abajo) para que
      // las push aparezcan arriba, como una notificación real.
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
        // Si ya está en la pantalla a la que apunta la push (por ejemplo,
        // el chat de esa mesa), el cambio llega por Realtime: no se repite.
        const ruta = notification.data?.['ruta'] as string | undefined;
        if (ruta && this.router.url === ruta) return;

        this.mostrarToastPush(notification.title ?? notification.body ?? 'Tenés una notificación nueva.');
      });

      // APP CERRADA o en segundo plano: el usuario tocó la notificación
      // desde la bandeja del sistema. Acá navegamos a donde corresponda.
      PushNotifications.addListener('pushNotificationActionPerformed', (accion: ActionPerformed) => {
        const ruta = accion.notification.data?.['ruta'] as string | undefined;
        if (ruta) {
          this.router.navigateByUrl(ruta);
        }
      });
    } catch (error) {
      console.error('Error inicializando push notifications:', error);
    }
  }

  private async mostrarToastPush(mensaje: string): Promise<void> {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      position: 'top',
      color: 'medium',
      cssClass: 'aviso-toast',
    });
    await toast.present();
  }

  /**
   * Reintenta guardar el token cacheado para el empleado con sesión. Se
   * llama desde login.page.ts, justo después de un login exitoso — el
   * caso más común (arranque en frío -> se pide permiso -> login). Si ya
   * había sesión al arrancar, lo resuelve asignarTokenDelDispositivo().
   * Es seguro llamarla aunque no haya token o no haya sesión: no hace nada.
   */
  guardarTokenPendienteSiHaySesion(): void {
    if (this.ultimoToken) {
      this.guardarToken(this.ultimoToken);
    }
  }

  private async guardarToken(token: string): Promise<void> {
    const empleadoId = this.auth.sesion()?.id;
    if (!empleadoId) {
      console.warn('Push token en espera: todavía no hay sesión de empleado.');
      return;
    }

    const { error } = await this.supabase.client.rpc('guardar_push_token', { p_token: token });

    if (error) {
      console.error(
        'Error guardando push token ->',
        'code:', error.code,
        '| message:', error.message,
        '| details:', error.details,
        '| hint:', error.hint,
        '| empleadoId enviado:', empleadoId
      );
    } else {
      console.log('Push token guardado correctamente para empleado', empleadoId);
    }
  }

  /**
   * Borra el token del dispositivo de push_tokens. Corre en cada cierre
   * de sesión (ver el constructor). La RPC borra por token y no depende de
   * la sesión de Supabase, así que el orden respecto de signOut no importa.
   */
  private async eliminarToken(): Promise<void> {
    if (!this.ultimoToken) return;

    const { error } = await this.supabase.client.rpc('eliminar_push_token', {
      p_token: this.ultimoToken,
    });

    if (error) {
      console.error('Error eliminando push token:', error);
    }
    // No se limpia this.ultimoToken: si el mismo dispositivo vuelve a
    // loguearse (otro empleado, o el mismo), guardarTokenPendienteSiHaySesion()
    // lo va a volver a registrar con el empleado_id correcto.
  }

  /**
   * Decide de quién es el dispositivo cuando el SO entrega el token (al
   * arrancar la app). Un celular es de una sola persona a la vez:
   *  1) Si hay sesión de empleado, el token es del empleado.
   *  2) Si no, y hay un cliente anónimo guardado, es del cliente.
   *  3) Si no hay nadie (por ejemplo, la sesión expiró con la app
   *     cerrada), se borra: no debe recibir las push de nadie.
   *
   * Antes se registraban el empleado y el cliente a la vez, y el último
   * en llegar se quedaba con el token.
   *
   * El cliente anónimo se lee directo de Preferences (en vez de inyectar
   * ClienteAnonimoService, que a su vez depende de este servicio — evita
   * la dependencia circular).
   */
  private async asignarTokenDelDispositivo(token: string): Promise<void> {
    if (this.auth.sesion()) {
      await this.guardarToken(token);
      return;
    }

    const { value: clienteId } = await Preferences.get({ key: CLAVE_CLIENTE_ANONIMO_ID });
    if (clienteId) {
      const { error } = await this.supabase.client.rpc('registrar_push_token_cliente', {
        p_cliente_id: clienteId,
        p_token: token,
      });
      if (error) {
        console.error('Error registrando push token de cliente anónimo (reintento):', error);
      }
      return;
    }

    await this.eliminarToken();
  }

  /**
   * Expone el token cacheado para registrarlo contra un cliente (anónimo
   * o registrado) en vez de un empleado — ver ClienteAnonimoService, que
   * lo usa junto con registrar_push_token_cliente. Null si Firebase
   * todavía no respondió con un token en este arranque de la app.
   */
  obtenerTokenActual(): string | null {
    return this.ultimoToken;
  }

  // ===== Catálogo de push =====
  //
  // Todas las notificaciones push de la app están acá, una por método.
  // Las pantallas solo llaman al método de negocio: ninguna arma títulos,
  // textos, destinatarios ni rutas. Se envían sin esperar: si falla, el
  // flujo de la pantalla sigue igual (los errores se registran abajo).
  //
  // Altas de mesa, plato o bebida: NO envían push (decisión del equipo,
  // la consigna no lo pide).

  /** Alta de empleado → dueño y supervisor. */
  avisarNuevoEmpleado(nombre: string, apellido: string, puesto: string): void {
    this.notificarEmpleados(
      'Nuevo empleado creado',
      `${nombre} ${apellido} fue dado de alta como ${puesto}.`,
      ['dueño', 'supervisor'],
      '/administracion/personal'
    );
  }

  /** Edición de mesa → dueño y supervisor. */
  avisarMesaActualizada(numeroMesa: number): void {
    this.notificarEmpleados(
      'Mesa actualizada',
      `Se modificó la Mesa ${numeroMesa}.`,
      ['dueño', 'supervisor'],
      '/administracion/salon/gestion'
    );
  }

  /** Baja de mesa → dueño y supervisor. */
  avisarMesaEliminada(numeroMesa: number): void {
    this.notificarEmpleados(
      'Mesa eliminada',
      `Se eliminó la Mesa ${numeroMesa}.`,
      ['dueño', 'supervisor'],
      '/administracion/salon/gestion'
    );
  }

  /** Aprobación o rechazo de un cliente registrado → dueño, supervisor y metre. */
  avisarClienteRevisado(nombre: string, apellido: string | null, aprobado: boolean): void {
    const nombreCompleto = `${nombre} ${apellido ?? ''}`.trim();
    this.notificarEmpleados(
      aprobado ? 'Cliente aprobado' : 'Cliente rechazado',
      `${nombreCompleto} fue ${aprobado ? 'aceptado' : 'rechazado'}.`,
      ['dueño', 'supervisor', 'metre'],
      '/administracion/solicitudes'
    );
  }

  /**
   * Cliente que se registra → dueño y supervisor. Si lo registró el
   * metre, también le llega a él como confirmación. Al cliente no se le
   * puede avisar por push: todavía no tiene sesión en ningún dispositivo
   * (se entera por email cuando se aprueba o rechaza su cuenta).
   */
  avisarNuevoClientePendiente(nombre: string, apellido: string, desdeMetre: boolean): void {
    this.notificarEmpleados(
      'Nuevo cliente pendiente',
      `${nombre} ${apellido} se registró y está pendiente de aprobación.`,
      desdeMetre ? ['dueño', 'supervisor', 'metre'] : ['dueño', 'supervisor'],
      '/administracion'
    );
  }

  /** Cliente anónimo que entra al local → metre. */
  avisarClienteAnonimoIngreso(nombre: string, apellido: string): void {
    this.notificarEmpleados(
      'Cliente no registrado acaba de ingresar',
      `${nombre} ${apellido} ingresó al local como invitado.`,
      ['metre'],
      '/metre/lista-espera'
    );
  }

  /** Cliente anónimo que pide una mesa → metre. */
  avisarClienteEnListaEspera(numeroMesa: number): void {
    this.notificarEmpleados(
      'Cliente en lista de espera',
      `Cliente no registrado solicitó la Mesa ${numeroMesa}.`,
      ['metre'],
      '/metre/lista-espera'
    );
  }

  /** Cliente vinculado a una mesa que intenta cerrar sesión → metre. */
  avisarCierreSesionBloqueado(numeroMesa: number): void {
    this.notificarEmpleados(
      'Cliente pidió cerrar sesión',
      `El cliente de la Mesa ${numeroMesa} intentó cerrar sesión estando ya vinculado. Se le indicó acercarse al mostrador.`,
      ['metre'],
      '/metre'
    );
  }

  /** Cliente anónimo que cierra sesión (borra su cuenta) → metre. */
  avisarClienteCerroSesion(nombre: string, mesaLiberada: number | null | undefined): void {
    this.notificarEmpleados(
      'Cliente cerró sesión',
      mesaLiberada
        ? `${nombre} cerró sesión. La Mesa ${mesaLiberada} quedó libre.`
        : `${nombre} cerró sesión.`,
      ['metre']
    );
  }

  /** El metre acepta la solicitud de mesa → cliente. */
  avisarMesaAsignada(clienteId: string): void {
    this.notificarCliente(
      'Mesa asignada',
      'Tu solicitud fue aceptada. Ya tenés una mesa asignada.',
      clienteId,
      '/cliente-anonimo'
    );
  }

  /** El metre rechaza la solicitud de mesa → cliente. */
  avisarSolicitudRechazada(clienteId: string): void {
    this.notificarCliente(
      'Solicitud rechazada',
      'Tu solicitud de mesa fue rechazada.',
      clienteId,
      '/cliente-anonimo/ver-mesas'
    );
  }

  /** Mensaje del cliente en el chat → todos los mozos. */
  avisarNuevaConsulta(mensaje: MensajeMesa): void {
    this.notificarEmpleados(
      `Consulta de la Mesa ${mensaje.numero_mesa}`,
      this.extracto(mensaje.texto),
      ['mozo'],
      `/consultas/${mensaje.solicitud_id}`
    );
  }

  /** Respuesta de un mozo en el chat → cliente de la estadía. */
  avisarRespuestaConsulta(mensaje: MensajeMesa): void {
    this.notificarCliente(
      `Respuesta de ${mensaje.autor_nombre}`,
      this.extracto(mensaje.texto),
      mensaje.cliente_id,
      `/consultas/${mensaje.solicitud_id}`
    );
  }

  /** Recorta el texto del chat para que entre en la notificación. */
  private extracto(texto: string): string {
    return texto.length > MAX_CARACTERES_EXTRACTO
      ? `${texto.slice(0, MAX_CARACTERES_EXTRACTO - 3)}…`
      : texto;
  }

  // ===== Transporte =====

  /**
   * Dispara una notificación real a través de la Edge Function
   * "enviar-notificacion" a los empleados de los puestos indicados.
   * `puestos` es obligatorio: la Edge Function, sin puestos, le manda la
   * push a TODOS los empleados, y eso nunca debe pasar por olvido.
   */
  private async notificarEmpleados(
    titulo: string,
    cuerpo: string,
    puestos: readonly Puesto[],
    ruta?: string
  ): Promise<void> {
    try {
      await this.supabase.client.functions.invoke('enviar-notificacion', {
        body: {
          titulo,
          mensaje: cuerpo,
          puestos,
          data: ruta ? { ruta } : {},
        },
      });
    } catch (error) {
      console.error('Error enviando notificación push (no bloqueante):', error);
    }
  }

  /**
   * Igual que notificarEmpleados, pero apunta a UN cliente puntual (por
   * su id en la tabla "clientes") en vez de a un conjunto de puestos.
   */
  private async notificarCliente(titulo: string, cuerpo: string, clienteId: string, ruta?: string): Promise<void> {
    try {
      await this.supabase.client.functions.invoke('enviar-notificacion', {
        body: {
          titulo,
          mensaje: cuerpo,
          clienteId,
          data: ruta ? { ruta } : {},
        },
      });
    } catch (error) {
      console.error('Error enviando notificación push a cliente (no bloqueante):', error);
    }
  }
}