import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import { SonidosService } from './sonidos.service';
import { EmpleadosService } from './empleados.service';
import { ClientesService } from './clientes.service';
import {
  EmpleadoSesion,
} from '../models/empleado.model';
import { rutaHomeSegunPuesto } from '../models/rutas-por-puesto';

export interface ResultadoLogin {
  ok: boolean;
  /** Mensaje listo para mostrar al usuario cuando ok = false */
  mensaje?: string;
  sesion?: EmpleadoSesion;
  /**
   * Solo presente cuando ok = true. 'empleado' es el caso de siempre
   * (usar sesion() + rutaHomeSegunPuesto); 'cliente' es un cliente
   * aprobado — no hay EmpleadoSesion para él, hay que navegar directo
   * a /cliente (el guard de esa ruta valida todo de nuevo del lado
   * del servidor, esto es solo para saber a dónde mandarlo).
   */
  tipo?: 'empleado' | 'cliente';
}

const DURACION_SESION_MS = 60 * 60 * 1000; // 1 hora, para cualquier perfil
const CLAVE_INICIO_SESION = 'merlot_sesion_inicio';

@Injectable({ providedIn: 'root' })
export class Auth {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly sonidos = inject(SonidosService);
  private readonly empleados = inject(EmpleadosService);
  private readonly clientes = inject(ClientesService);

  private readonly _sesion = signal<EmpleadoSesion | null>(null);
  readonly sesion = this._sesion.asReadonly();

  readonly estaLogueado = computed(() => this._sesion() !== null);

  private timerExpiracion: ReturnType<typeof setTimeout> | null = null;

  /** Ver alCerrarSesion(). */
  private readonly tareasAlCerrarSesion: Array<() => Promise<void>> = [];

  /**
   * Restaura la sesión de Supabase Auth al iniciar la aplicación, y
   * retoma la cuenta regresiva de expiración desde donde había quedado
   * (no la reinicia a una hora completa solo porque se reabrió la app).
   */
  async restaurarSesion(): Promise<void> {
    const { data, error } =
      await this.supabase.client.auth.getSession();

    if (error) {
      console.error('Error al restaurar sesión:', error);
      this._sesion.set(null);
      return;
    }

    const user = data.session?.user;

    if (!user) {
      this._sesion.set(null);
      return;
    }

    if (this.sesionYaExpiro()) {
      await this.cerrarSesionCompleta({ sonido: false, redirigir: false });
      return;
    }

    this.programarExpiracion(this.msRestantes());
    await this.cargarEmpleado(user.id);
  }

  /**
   * Inicia sesión utilizando Supabase Auth.
   */
  async login(
    email: string,
    password: string
  ): Promise<ResultadoLogin> {
    const correo = email.trim().toLowerCase();

    const { data, error } =
      await this.supabase.client.auth.signInWithPassword({
        email: correo,
        password,
      });

    if (error) {
      console.error('Error de Supabase Auth:', error);

      return {
        ok: false,
        mensaje: 'Email o contraseña incorrectos.',
      };
    }

    const user = data.user;

    if (!user) {
      return {
        ok: false,
        mensaje: 'No se pudo obtener el usuario autenticado.',
      };
    }

    return await this.cargarEmpleado(user.id);
  }

  /**
   * Busca el empleado asociado al usuario autenticado.
   * IMPORTANTE: acá ya NO se valida el puesto (antes rechazaba a
   * cualquiera que no fuera dueño/supervisor, lo que bloqueaba por
   * completo el login de cocinero/cantinero/mozo/metre). Esa validación
   * de "quién puede entrar a cada ruta" vive en puestoGuard.
   * Acá solo se valida que el empleado exista y esté activo.
   */
  private async cargarEmpleado(
    authUserId: string
  ): Promise<ResultadoLogin> {
    const resultado = await this.empleados.obtenerPorAuthId(authUserId);

    if (!resultado.ok) {
      await this.cerrarSesionCompleta({ sonido: false, redirigir: false });

      return {
        ok: false,
        mensaje: 'No se pudo cargar la información del empleado.',
      };
    }

    const sesion = resultado.dato;
    if (!sesion) {
      // No es empleado — puede ser un cliente registrado (pendiente,
      // rechazado, o aprobado) o directamente un email que no existe
      // en ninguna de las dos tablas.
      return await this.evaluarComoCliente(authUserId);
    }

    if (sesion.estado !== 'On') {
      await this.cerrarSesionCompleta({ sonido: false, redirigir: false });

      return {
        ok: false,
        mensaje:
          'Tu usuario está dado de baja. Contactá al dueño o supervisor.',
      };
    }

    this._sesion.set(sesion);
    this.iniciarCuentaRegresiva();

    return {
      ok: true,
      sesion,
      tipo: 'empleado',
    };
  }

  /**
   * El usuario autenticado no es empleado — se fija si es un cliente y en
   * qué estado. Si está "aprobado", el login es válido: se deja la sesión
   * de Supabase Auth activa (clienteAprobadoGuard la vuelve a validar del
   * lado del servidor antes de dejarlo entrar a /cliente) y se devuelve
   * ok:true con tipo:'cliente' para que login.page.ts sepa navegarlo ahí
   * en vez de al flujo de empleados. Para pendiente/rechazado/no
   * encontrado, se cierra la sesión — no tienen nada que hacer logueados.
   */
  private async evaluarComoCliente(authUserId: string): Promise<ResultadoLogin> {
    const resultado = await this.clientes.obtenerPorAuthId(authUserId);

    if (!resultado.ok) {
      await this.cerrarSesionCompleta({ sonido: false, redirigir: false });
      return { ok: false, mensaje: 'No se pudo validar el usuario. Probá de nuevo.' };
    }

    const cliente = resultado.dato;

    if (cliente?.estado === 'aprobado') {
      this.iniciarCuentaRegresiva();
      return { ok: true, tipo: 'cliente' };
    }

    await this.cerrarSesionCompleta({ sonido: false, redirigir: false });

    if (!cliente) {
      return { ok: false, mensaje: 'El email ingresado no se encuentra registrado.' };
    }

    switch (cliente.estado) {
      case 'pendiente':
        return { ok: false, mensaje: 'Su solicitud está pendiente de validación.' };
      case 'rechazado':
        return {
          ok: false,
          mensaje: 'Su solicitud fue rechazada, por favor póngase en contacto con la administración.',
        };
      default:
        return { ok: false, mensaje: 'El email ingresado no se encuentra registrado.' };
    }
  }

  /**
   * Se llama desde bienvenida.page.ts y login.page.ts: si ya hay una
   * sesión activa (empleado o cliente aprobado), navega directo a la
   * pantalla que corresponda y devuelve true — el caller no debe mostrar
   * nada más. Si no hay sesión válida, devuelve false y el caller sigue
   * su flujo normal (mostrar bienvenida/login).
   */
  async redirigirSiYaHaySesion(): Promise<boolean> {
    await this.restaurarSesion();

    const sesionEmpleado = this._sesion();
    if (sesionEmpleado) {
      this.router.navigate([rutaHomeSegunPuesto(sesionEmpleado.puesto)], { replaceUrl: true });
      return true;
    }

    const cliente = await this.clientes.obtenerClienteActual();
    if (cliente?.estado === 'aprobado') {
      this.router.navigate(['/cliente'], { replaceUrl: true });
      return true;
    }

    return false;
  }

  /**
   * Cierra la sesión de Supabase Auth a pedido del usuario (botón
   * "Cerrar sesión"), sea cual sea su perfil — reproduce el sonido de
   * cierre y navega a /login.
   */
  async logout(): Promise<void> {
    await this.ejecutarTareasAlCerrarSesion();
    await this.cerrarSesionCompleta({ sonido: true, redirigir: false });
  }

  /**
   * Registra una tarea que corre cada vez que el usuario deja de tener
   * sesión: botón "Cerrar sesión" o expiración automática a la hora.
   *
   * Existe para que NotificacionesService borre el token de push del
   * dispositivo sin que Auth lo inyecte: NotificacionesService ya inyecta
   * Auth, y al revés se formaría una dependencia circular.
   */
  alCerrarSesion(tarea: () => Promise<void>): void {
    this.tareasAlCerrarSesion.push(tarea);
  }

  private async ejecutarTareasAlCerrarSesion(): Promise<void> {
    for (const tarea of this.tareasAlCerrarSesion) {
      try {
        await tarea();
      } catch (error) {
        // Una tarea que falla nunca debe impedir el cierre de sesión.
        console.error('Error en una tarea de cierre de sesión:', error);
      }
    }
  }

  // ===== Expiración de sesión (1 hora, sea el perfil que sea) =====

  private iniciarCuentaRegresiva(): void {
    localStorage.setItem(CLAVE_INICIO_SESION, Date.now().toString());
    this.programarExpiracion(DURACION_SESION_MS);
  }

  private msRestantes(): number {
    const inicio = Number(localStorage.getItem(CLAVE_INICIO_SESION) ?? 0);
    if (!inicio) return DURACION_SESION_MS;
    return Math.max(0, DURACION_SESION_MS - (Date.now() - inicio));
  }

  private sesionYaExpiro(): boolean {
    const inicio = localStorage.getItem(CLAVE_INICIO_SESION);
    if (!inicio) return false; // sesión de antes de este cambio: se le da 1 hora desde ahora
    return this.msRestantes() <= 0;
  }

  private programarExpiracion(msRestantes: number): void {
    this.cancelarTimerExpiracion();
    this.timerExpiracion = setTimeout(async () => {
      await this.ejecutarTareasAlCerrarSesion();
      await this.cerrarSesionCompleta({ sonido: true, redirigir: true });
    }, msRestantes);
  }

  private cancelarTimerExpiracion(): void {
    if (this.timerExpiracion) {
      clearTimeout(this.timerExpiracion);
      this.timerExpiracion = null;
    }
  }

  /**
   * Punto único de cierre de sesión, para todos los casos: botón
   * "Cerrar sesión", expiración automática a la hora, o un error que
   * obliga a desloguear. Centralizado acá para que el sonido y la
   * limpieza del timer/timestamp nunca se olviden en algún perfil.
   */
  private async cerrarSesionCompleta(opciones: { sonido: boolean; redirigir: boolean }): Promise<void> {
    this.cancelarTimerExpiracion();
    localStorage.removeItem(CLAVE_INICIO_SESION);

    const { error } = await this.supabase.client.auth.signOut();
    if (error) {
      console.error('Error al cerrar sesión:', error);
    }

    this._sesion.set(null);

    if (opciones.sonido) {
      this.sonidos.cierreSesion();
    }
    if (opciones.redirigir) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }
}



