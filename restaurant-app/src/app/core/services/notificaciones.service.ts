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

const CLAVE_CLIENTE_ANONIMO_ID = 'merlot_cliente_anonimo_id';

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
        this.guardarTokenPendienteSiHaySesion();
        this.registrarTokenClienteAnonimoSiCorresponde(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Error registrando para push notifications:', error);
      });

      // APP ABIERTA (foreground): el sistema operativo NO muestra la
      // notificación solo — hay que mostrarla nosotros manualmente.
      // Se usa un toast propio (no avisos.info(), que va abajo) para que
      // las push aparezcan arriba, como una notificación real.
      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
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
   * Reintenta guardar el token cacheado. Se llama:
   *  1) desde el listener 'registration' (por si YA había sesión, ej:
   *     restaurarSesion() encontró una sesión previa antes de esto), y
   *  2) desde login.page.ts, justo después de un login exitoso — que es
   *     el caso más común (arranque en frío -> se pide permiso -> login).
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
   * Se llama al cerrar sesión (ANTES de invalidar la sesión de Supabase
   * Auth, ver los cerrarSesion() de administracion/cocina/cantina). Sin
   * esto, el dispositivo seguía recibiendo notificaciones del empleado
   * que se deslogueó, porque el token nunca se borraba de push_tokens.
   */
  async eliminarTokenAlCerrarSesion(): Promise<void> {
    if (!this.ultimoToken) return;

    const { error } = await this.supabase.client.rpc('eliminar_push_token', {
      p_token: this.ultimoToken,
    });

    if (error) {
      console.error('Error eliminando push token al cerrar sesión:', error);
    }
    // No se limpia this.ultimoToken: si el mismo dispositivo vuelve a
    // loguearse (otro empleado, o el mismo), guardarTokenPendienteSiHaySesion()
    // lo va a volver a registrar con el empleado_id correcto.
  }

  /**
   * Mismo problema que con empleados: el evento 'registration' puede
   * llegar antes de que exista un cliente_id guardado. Se consulta acá
   * directo (en vez de inyectar ClienteAnonimoService, que a su vez
   * depende de este servicio — evita la dependencia circular).
   */
  private async registrarTokenClienteAnonimoSiCorresponde(token: string): Promise<void> {
    const { value: clienteId } = await Preferences.get({ key: CLAVE_CLIENTE_ANONIMO_ID });
    if (!clienteId) return;

    const { error } = await this.supabase.client.rpc('registrar_push_token_cliente', {
      p_cliente_id: clienteId,
      p_token: token,
    });

    if (error) {
      console.error('Error registrando push token de cliente anónimo (reintento):', error);
    }
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

  /**
   * Dispara una notificación real a través de la Edge Function
   * "enviar-notificacion". Se llama SIEMPRE que se crea algo (empleado,
   * mesa, plato, bebida) — ver los onSubmit() de cada formulario.
   */
  async notificarCreacion(
    titulo: string,
    cuerpo: string,
    opciones?: { puestos?: string[]; ruta?: string }
  ): Promise<void> {
    try {
      await this.supabase.client.functions.invoke('enviar-notificacion', {
        body: {
          titulo,
          mensaje: cuerpo,
          puestos: opciones?.puestos,
          data: opciones?.ruta ? { ruta: opciones.ruta } : {},
        },
      });
    } catch (error) {
      console.error('Error enviando notificación push (no bloqueante):', error);
    }
  }

  /**
   * Igual que notificarCreacion, pero apunta a UN cliente puntual (por su
   * id en la tabla "clientes") en vez de a un conjunto de puestos —
   * usado para avisarle al cliente anónimo si su solicitud de mesa fue
   * aceptada o rechazada.
   */
  async notificarCliente(titulo: string, cuerpo: string, clienteId: string, ruta?: string): Promise<void> {
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