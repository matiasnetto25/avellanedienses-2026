import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { SupabaseService } from './supabase.service';
import { AvisosService } from './avisos.service';
import { Auth } from './auth';
import { ClientesService } from './clientes.service';
import { Puesto } from '../models/empleado.model';
import { MensajeMesa } from '../models/consulta.model';
import { SectorItem } from '../models/pedido.model';
import { formatearMinutos } from '../utils/minutos';

const CLAVE_CLIENTE_ANONIMO_ID = 'merlot_cliente_anonimo_id';
/** Canal de Android con importancia máxima: hace que el aviso salte arriba como banner. */
const CANAL_AVISOS = 'merlot-avisos';
/** Último token que este dispositivo registró en la base: si FCM lo rota, se borra el viejo. */
const CLAVE_ULTIMO_TOKEN = 'merlot_push_token_registrado';
/** Largo máximo del texto del chat que se muestra en la push. */
const MAX_CARACTERES_EXTRACTO = 80;

/** A quién avisa y adónde lleva la push de un pedido confirmado, según el sector (punto 14). */
const DESTINOS_POR_SECTOR: Record<SectorItem, { puestos: Puesto[]; ruta: string; cuerpo: string }> = {
  cocina: { puestos: ['cocinero'], ruta: '/cocina/ahora', cuerpo: 'Hay platos para preparar.' },
  bar: { puestos: ['cantinero'], ruta: '/cantina/ahora', cuerpo: 'Hay bebidas para preparar.' },
};

@Injectable({ providedIn: 'root' })
export class NotificacionesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(Auth);
  // ClientesService solo depende de SupabaseService: no hay dependencia
  // circular (ClienteActualService sí la tendría, vía ClienteAnonimoService).
  private readonly clientes = inject(ClientesService);
  private readonly router = inject(Router);
  private readonly avisos = inject(AvisosService);

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
    // 1. Verificamos los permisos de notificaciones push.
    let permiso = await PushNotifications.checkPermissions();

    if (permiso.receive === 'prompt') {
      permiso = await PushNotifications.requestPermissions();
    }

    if (permiso.receive !== 'granted') {
      console.warn('Permiso de notificaciones push no otorgado.');
      return;
    }

    // 2. Creamos el canal de notificaciones de Android.
    await this.crearCanalDePush();

    // 3. Registramos los listeners ANTES de solicitar el registro.
    await PushNotifications.addListener(
      'registration',
      (token: Token) => {
        console.log('Token push recibido correctamente.');

        this.ultimoToken = token.value;

        void this.asignarTokenDelDispositivo(token.value);
      }
    );

    await PushNotifications.addListener(
      'registrationError',
      (error) => {
        console.error(
          'Error registrando para push notifications:',
          error
        );
      }
    );

    // 4. Escuchamos las notificaciones cuando la app está abierta.
    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        const ruta = notification.data?.['ruta'] as
          | string
          | undefined;

        const texto = [
          notification.title,
          notification.body
        ]
          .filter(Boolean)
          .join(': ');

        void this.mostrarNotificacionDelSistema(
          notification.title,
          notification.body,
          ruta
        ).then((mostrada) => {
          if (!mostrada) {
            void this.mostrarToastPush(
              texto || 'Tenés una notificación nueva.',
              ruta
            );
          }
        });
      }
    );

    // 5. Escuchamos cuando el usuario toca una notificación.
    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (accion: ActionPerformed) => {
        const ruta = accion.notification.data?.['ruta'] as
          | string
          | undefined;

        if (ruta) {
          void this.router.navigateByUrl(ruta);
        }
      }
    );

    // 6. Preparamos las notificaciones locales para mostrar
    // avisos del sistema cuando la app está abierta.
    await this.prepararAvisosDelSistema();

    // 7. Finalmente registramos el dispositivo en FCM.
    await PushNotifications.register();

  } catch (error) {
    console.error(
      'Error inicializando push notifications:',
      error
    );

    // Permitimos reintentar la inicialización si falló.
    this.inicializado = false;
  }
}

  /**
   * Crea el canal de máxima importancia que usa FCM con la app cerrada (el
   * AndroidManifest lo declara como canal por defecto). Sin él, Android
   * muestra la push en un canal común, sin banner. No depende del permiso
   * de notificaciones locales.
   */
  private async crearCanalDePush(): Promise<void> {
    try {
      await PushNotifications.createChannel({
        id: CANAL_AVISOS,
        name: 'Avisos de Merlot',
        description: 'Mesas, pedidos y consultas',
        importance: 5,
        visibility: 1,
        vibration: true,
      });
    } catch (error) {
      console.warn('No se pudo crear el canal de push:', error);
    }
  }

  /**
   * Deja listo lo necesario para mostrar notificaciones del sistema con la
   * app abierta: permiso, canal de máxima importancia y el toque sobre la
   * notificación (lleva a la ruta de la push). Si falla, la push sigue
   * funcionando igual: queda el aviso dentro de la app.
   */
  private async prepararAvisosDelSistema(): Promise<void> {
    try {
      let permiso = await LocalNotifications.checkPermissions();
      if (permiso.display === 'prompt') {
        permiso = await LocalNotifications.requestPermissions();
      }
      if (permiso.display !== 'granted') return;

      await LocalNotifications.createChannel({
        id: CANAL_AVISOS,
        name: 'Avisos de Merlot',
        description: 'Mesas, pedidos y consultas',
        importance: 5,
        visibility: 1,
        vibration: true,
      });

      await LocalNotifications.addListener('localNotificationActionPerformed', (accion) => {
        const ruta = accion.notification.extra?.['ruta'] as string | undefined;
        if (ruta) void this.router.navigateByUrl(ruta);
      });
    } catch (error) {
      console.warn('No se pudieron preparar las notificaciones del sistema:', error);
    }
  }

  /** La misma push, como notificación del sistema (banner arriba y en la bandeja), con la app abierta. */
  private async mostrarNotificacionDelSistema(titulo?: string, cuerpo?: string, ruta?: string): Promise<boolean> {
    try {
      const permiso = await LocalNotifications.checkPermissions();
      if (permiso.display !== 'granted') return false;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now() % 2147483647,
            title: titulo || 'Merlot',
            body: cuerpo || 'Tenés una notificación nueva.',
            channelId: CANAL_AVISOS,
            extra: ruta ? { ruta } : {},
          },
        ],
      });
      return true;
    } catch (error) {
      console.warn('No se pudo mostrar la notificación del sistema:', error);
      return false;
    }
  }

  private async mostrarToastPush(mensaje: string, ruta?: string): Promise<void> {
    await this.avisos.push(mensaje, ruta);
  }

  /**
   * Vuelve a decidir de quién es el token cacheado, ahora que alguien
   * inició sesión (empleado o cliente registrado). Se llama desde
   * login.page.ts, justo después de un login exitoso — el caso más común
   * (arranque en frío -> se pide permiso -> login). Si ya había sesión al
   * arrancar, lo resolvió asignarTokenDelDispositivo() en ese momento.
   * Es seguro llamarla aunque no haya token o no haya sesión.
   */
  guardarTokenPendienteSiHaySesion(): void {
    if (this.ultimoToken) {
      void this.asignarTokenDelDispositivo(this.ultimoToken);
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
   * arrancar la app) y después de cada login. Un celular es de una sola
   * persona a la vez, en el mismo orden que ClienteActualService:
   *  1) Si hay sesión de empleado, el token es del empleado.
   *  2) Si no, y hay un cliente anónimo guardado, es del cliente.
   *  3) Si no, y hay sesión de un cliente registrado APROBADO, es suyo
   *     (punto 13: si no, no le llega la push de pedido rechazado).
   *  4) Si no hay nadie (por ejemplo, la sesión expiró con la app
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
    await this.descartarTokenAnterior(token);

    if (this.auth.sesion()) {
      await this.guardarToken(token);
      return;
    }

    const { value: clienteAnonimoId } = await Preferences.get({ key: CLAVE_CLIENTE_ANONIMO_ID });
    if (clienteAnonimoId) {
      await this.registrarTokenCliente(clienteAnonimoId, token);
      return;
    }

    const clienteRegistrado = await this.clientes.obtenerClienteActual();
    if (clienteRegistrado?.estado === 'aprobado') {
      await this.registrarTokenCliente(clienteRegistrado.id, token);
      return;
    }

    await this.eliminarToken();
  }

  /**
   * Si FCM rotó el token del dispositivo, borra el anterior de push_tokens.
   * La Edge Function busca el token de un cliente con maybeSingle(): con dos
   * filas para el mismo cliente falla y el cliente se queda sin push.
   */
  private async descartarTokenAnterior(tokenNuevo: string): Promise<void> {
    try {
      const { value: anterior } = await Preferences.get({ key: CLAVE_ULTIMO_TOKEN });
      if (anterior && anterior !== tokenNuevo) {
        const { error } = await this.supabase.client.rpc('eliminar_push_token', { p_token: anterior });
        if (error) {
          console.error('Error borrando el push token anterior:', error);
          return;
        }
      }
      await Preferences.set({ key: CLAVE_ULTIMO_TOKEN, value: tokenNuevo });
    } catch (error) {
      console.warn('No se pudo descartar el push token anterior:', error);
    }
  }

  /** Asocia el token a un cliente (anónimo o registrado); le quita el empleado si lo tenía. */
  private async registrarTokenCliente(clienteId: string, token: string): Promise<void> {
    const { error } = await this.supabase.client.rpc('registrar_push_token_cliente', {
      p_cliente_id: clienteId,
      p_token: token,
    });
    if (error) {
      console.error('Error registrando push token de cliente:', error);
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

  /** Modificación de un empleado → dueño y supervisor. */
  avisarEmpleadoActualizado(nombre: string, apellido: string): void {
    this.notificarEmpleados(
      'Empleado actualizado',
      `Se modificaron los datos de ${nombre} ${apellido}.`,
      ['dueño', 'supervisor'],
      '/administracion/personal'
    );
  }

  /** Baja de un empleado → dueño y supervisor. */
  avisarEmpleadoEliminado(nombre: string, apellido: string): void {
    this.notificarEmpleados(
      'Empleado eliminado',
      `${nombre} ${apellido} fue eliminado del personal.`,
      ['dueño', 'supervisor'],
      '/administracion/personal'
    );
  }

  /** Alta de mesa → dueño y supervisor. */
  avisarMesaCreada(numeroMesa: number): void {
    this.notificarEmpleados(
      'Mesa creada',
      `Se creó la Mesa ${numeroMesa}.`,
      ['dueño', 'supervisor'],
      '/administracion/salon'
    );
  }

  /** Edición de mesa → dueño y supervisor. */
  avisarMesaActualizada(numeroMesa: number): void {
    this.notificarEmpleados(
      'Mesa actualizada',
      `Se modificó la Mesa ${numeroMesa}.`,
      ['dueño', 'supervisor'],
      '/administracion/salon'
    );
  }

  /** Alta de un plato o bebida (cocinero/cantinero) → dueño, supervisor y el sector que lo crea. */
  avisarProductoCreado(nombre: string, esBebida: boolean): void {
    this.notificarEmpleados(
      esBebida ? 'Bebida creada' : 'Plato creado',
      `Se agregó "${nombre}" a la carta.`,
      ['dueño', 'supervisor', esBebida ? 'cantinero' : 'cocinero'],
      undefined
    );
  }

  /** Edición de un plato o bebida (cocinero/cantinero) → dueño y supervisor. */
  avisarProductoActualizado(nombre: string, esBebida: boolean): void {
    this.notificarEmpleados(
      esBebida ? 'Bebida actualizada' : 'Plato actualizado',
      `Se modificó "${nombre}" de la carta.`,
      ['dueño', 'supervisor', esBebida ? 'cantinero' : 'cocinero'],
      undefined
    );
  }

  /** Baja de un plato o bebida (cocinero/cantinero) → dueño y supervisor. */
  avisarProductoEliminado(nombre: string, esBebida: boolean): void {
    this.notificarEmpleados(
      esBebida ? 'Bebida eliminada' : 'Plato eliminado',
      `Se eliminó "${nombre}" de la carta.`,
      ['dueño', 'supervisor', esBebida ? 'cantinero' : 'cocinero'],
      undefined
    );
  }

  /** Baja de mesa → dueño y supervisor. */
  avisarMesaEliminada(numeroMesa: number): void {
    this.notificarEmpleados(
      'Mesa eliminada',
      `Se eliminó la Mesa ${numeroMesa}.`,
      ['dueño', 'supervisor'],
      '/administracion/salon'
    );
  }

  /** Aprobación o rechazo de un cliente registrado → dueño y supervisor. */
  avisarClienteRevisado(nombre: string, apellido: string | null, aprobado: boolean): void {
    const nombreCompleto = `${nombre} ${apellido ?? ''}`.trim();
    this.notificarEmpleados(
      aprobado ? 'Cliente aprobado' : 'Cliente rechazado',
      `${nombreCompleto} fue ${aprobado ? 'aceptado' : 'rechazado'}.`,
      ['dueño', 'supervisor'],
      '/administracion/ahora'
    );
  }

  /**
   * Cliente que se registra → dueño y supervisor. Al cliente no se le
   * puede avisar por push: todavía no tiene sesión en ningún dispositivo
   * (se entera por email cuando se aprueba o rechaza su cuenta).
   */
  avisarNuevoClientePendiente(nombre: string, apellido: string, _desdeMetre = false): void {
    this.notificarEmpleados(
      'Nuevo cliente pendiente',
      `${nombre} ${apellido} se registró y está pendiente de aprobación.`,
      ['dueño', 'supervisor'],
      '/administracion/ahora'
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

  /** El cliente escaneó el QR de ingreso y espera que le asignen mesa → metre. */
  avisarClienteEnListaEspera(nombre: string): void {
    this.notificarEmpleados(
      'Cliente en lista de espera',
      `${nombre} escaneó el QR de ingreso y espera una mesa.`,
      ['metre'],
      '/metre/lista-espera'
    );
  }

  /** El cliente escaneó el QR de su mesa y quedó vinculado → metre. */
  avisarClienteVinculado(nombre: string, numeroMesa: number): void {
    this.notificarEmpleados(
      'Cliente vinculado a su mesa',
      `${nombre} escaneó el QR y ya está en la Mesa ${numeroMesa}.`,
      ['metre'],
      '/metre/lista-espera'
    );
  }

  /** El cliente escaneó bien el QR de su mesa → el mismo cliente. */
  avisarMesaVinculadaCliente(clienteId: string, numeroMesa: number): void {
    this.notificarCliente(
      'Mesa confirmada',
      `Escaneaste correctamente la Mesa ${numeroMesa}. Ya podés ver el menú.`,
      clienteId,
      '/cliente/inicio'
    );
  }

  /** Cliente vinculado a una mesa que intenta cerrar sesión → metre. */
  avisarCierreSesionBloqueado(numeroMesa: number): void {
    this.notificarEmpleados(
      'Cliente pidió cerrar sesión',
      `El cliente de la Mesa ${numeroMesa} intentó cerrar sesión estando ya vinculado. Se le indicó acercarse al mostrador.`,
      ['metre'],
      '/metre/lista-espera'
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

  /** El metre le asigna una mesa → cliente. */
  avisarMesaAsignada(clienteId: string, numeroMesa: number): void {
    this.notificarCliente(
      'Mesa asignada',
      `Tu mesa es la Mesa ${numeroMesa}. Acercate y escaneá el QR que está sobre la mesa.`,
      clienteId,
      '/cliente/inicio'
    );
  }

  /** El metre rechaza la solicitud de mesa → cliente. */
  avisarSolicitudRechazada(clienteId: string): void {
    this.notificarCliente(
      'Solicitud rechazada',
      'El maître no pudo asignarte una mesa. Podés volver a anotarte.',
      clienteId,
      '/cliente/inicio'
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

  /** El cliente envía su pedido → todos los mozos (lo tiene que confirmar uno). */
  avisarNuevoPedido(numeroMesa: number, cantidadProductos: number, total: number, tiempoEstimadoMin: number): void {
    this.notificarEmpleados(
      `Nuevo pedido de la Mesa ${numeroMesa}`,
      this.resumenPedido(cantidadProductos, total, tiempoEstimadoMin),
      ['mozo'],
      '/mozo/pedidos'
    );
  }

  /**
   * El mozo rechaza el pedido → cliente de la estadía (punto 13). La ruta
   * abre «Estado de mi pedido», que muestra el aviso con el motivo completo.
   */
  avisarPedidoRechazado(clienteId: string, mesaId: string, motivo: string): void {
    this.notificarCliente(
      'Tu pedido fue rechazado',
      this.extracto(motivo),
      clienteId,
      `/mesa/${mesaId}/estado-pedido`
    );
  }

  /**
   * El mozo confirma el pedido → cocineros y/o cantineros (punto 14). Una
   * push por sector que interviene: a un sector sin ítems no le llega nada.
   */
  avisarPedidoDerivado(numeroMesa: number, sectores: SectorItem[]): void {
    for (const sector of sectores) {
      const destino = DESTINOS_POR_SECTOR[sector];
      this.notificarEmpleados(`Nuevo pedido · Mesa ${numeroMesa}`, destino.cuerpo, destino.puestos, destino.ruta);
    }
  }

  
  /** Todos los productos del pedido están listos → mozos (punto 18). */
  async avisarPedidoListo(numeroMesa: number): Promise<void> {
    await this.notificarEmpleados(
      `Pedido listo · Mesa ${numeroMesa}`,
      'Todos los productos del pedido están listos para entregar.',
      ['mozo'],
      '/mozo/pedidos'
    );
  }


  /** El mozo confirma el pedido → cliente de la estadía (punto 14). */
  avisarPedidoConfirmado(clienteId: string, mesaId: string): void {
    this.notificarCliente(
      'Tu pedido fue confirmado',
      'Ya lo están preparando.',
      clienteId,
      `/mesa/${mesaId}/estado-pedido`
    );
  }

  /**
   * El mozo entrega el pedido → cliente de la estadía (punto 19). La ruta
   * abre «Estado de mi pedido», donde está el botón para confirmar.
   */
  avisarPedidoEntregado(clienteId: string, mesaId: string): void {
    this.notificarCliente(
      'Tu pedido ya está en tu mesa',
      'Por favor, confirmá que lo recibiste.',
      clienteId,
      `/mesa/${mesaId}/estado-pedido`
    );
  }

  /** El cliente dice que todavía no recibió el pedido → mozos (punto 19). */
  avisarPedidoNoRecibido(numeroMesa: number): void {
    this.notificarEmpleados(
      `Mesa ${numeroMesa}: todavía no recibió el pedido`,
      'El cliente avisó que no le llegó. Volvé a entregarlo.',
      ['mozo'],
      '/mozo/pedidos'
    );
  }

  /** Cocina o bar empieza a preparar → cliente de la estadía (punto 16). */
  avisarPreparacionIniciada(clienteId: string, mesaId: string, sector: SectorItem): void {
    this.notificarCliente(
      'Estamos preparando tu pedido',
      sector === 'cocina' ? 'La cocina empezó con tus platos.' : 'La barra empezó con tus bebidas.',
      clienteId,
      `/mesa/${mesaId}/estado-pedido`
    );
  }

  /** El cliente corrige y reenvía su pedido rechazado → todos los mozos (punto 13). */
  avisarPedidoModificado(
    numeroMesa: number,
    cantidadProductos: number,
    total: number,
    tiempoEstimadoMin: number
  ): void {
    this.notificarEmpleados(
      `Pedido modificado · Mesa ${numeroMesa}`,
      `El cliente corrigió su pedido. ${this.resumenPedido(cantidadProductos, total, tiempoEstimadoMin)}`,
      ['mozo'],
      '/mozo/pedidos'
    );
  }

  /** «3 productos · Total $26.000 · ~25 minutos», para las push de pedidos. */
  private resumenPedido(cantidadProductos: number, total: number, tiempoEstimadoMin: number): string {
    const productos = `${cantidadProductos} ${cantidadProductos === 1 ? 'producto' : 'productos'}`;
    return `${productos} · Total $${total.toLocaleString('es-AR')} · ~${formatearMinutos(tiempoEstimadoMin)}`;
  }

  /** Recorta un texto (del chat o el motivo de un rechazo) para que entre en la notificación. */
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
    await this.enviar(titulo, { titulo, mensaje: cuerpo, puestos }, ruta);
  }

  /**
   * Igual que notificarEmpleados, pero apunta a UN cliente puntual (por
   * su id en la tabla "clientes") en vez de a un conjunto de puestos.
   */
  private async notificarCliente(
    titulo: string,
    cuerpo: string,
    clienteId: string,
    ruta?: string
  ): Promise<void> {
    await this.enviar(titulo, { titulo, mensaje: cuerpo, clienteId }, ruta);
  }

  /**
   * Invoca la Edge Function y deja registrado el resultado. La función
   * responde 200 aun cuando falla (con ok:false) y FCM puede rechazar
   * tokens, así que se mira el cuerpo: sin esto una push perdida no deja
   * rastro. No bloquea el flujo de la pantalla.
   */
  private async enviar(
    titulo: string,
    destino: Record<string, unknown>,
    ruta?: string
  ): Promise<void> {
    try {
      const { data, error } = await this.supabase.client.functions.invoke('enviar-notificacion', {
        body: {
          ...destino,
          data: { ...(ruta ? { ruta } : {}) },
        },
      });

      if (error) {
        console.error(`Push "${titulo}" NO enviada (error al invocar la función):`, error);
      } else if (!data?.ok) {
        console.error(`Push "${titulo}" NO enviada (la función respondió ok:false):`, data?.error?.message);
      } else if (data.enviados === 0) {
        console.warn(`Push "${titulo}": ningún dispositivo la recibió.`, data.mensaje ?? data.errores);
      } else if (data.errores?.length) {
        console.warn(`Push "${titulo}": ${data.enviados} enviada(s), FCM rechazó otras:`, data.errores);
      }
    } catch (error) {
      console.error(`Error enviando la push "${titulo}" (no bloqueante):`, error);
    }
  }
}
