import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase.service';
import {
  EmpleadoRow,
  EmpleadoSesion,
  PUESTOS_ADMIN,
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

  private readonly _sesion = signal<EmpleadoSesion | null>(null);
  readonly sesion = this._sesion.asReadonly();

  readonly estaLogueado = computed(() => this._sesion() !== null);

  private timerExpiracion: ReturnType<typeof setTimeout> | null = null;

  /** Solo lo usa adminGuard (ruta /administracion) */
  readonly puedeAccederAdministracion = computed(() => {
    const s = this._sesion();

    return !!s &&
      s.estado === 'On' &&
      (PUESTOS_ADMIN as string[]).includes(s.puesto);
  });

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
   * de "quién puede entrar a Administración" vive en adminGuard;
   * cocineroGuard/cantineroGuard hacen lo mismo para sus rutas.
   * Acá solo se valida que el empleado exista y esté activo.
   */
  private async cargarEmpleado(
    authUserId: string
  ): Promise<ResultadoLogin> {
    const { data, error } = await this.supabase.client
      .from('empleados')
      .select(
        'id, auth_user_id, estado, nombre, apellido, cuil, email, puesto, foto'
      )
      .eq('auth_user_id', authUserId)
      .maybeSingle<EmpleadoRow>();

    if (error) {
      console.error(
        'Error buscando empleado:',
        JSON.stringify(error, null, 2)
      );

      await this.cerrarSesionCompleta({ sonido: false, redirigir: false });

      return {
        ok: false,
        mensaje: 'No se pudo cargar la información del empleado.',
      };
    }

    if (!data) {
      // No es empleado — puede ser un cliente registrado (pendiente,
      // rechazado, o aprobado) o directamente un email que no existe
      // en ninguna de las dos tablas.
      return await this.evaluarComoCliente(authUserId);
    }

    if (data.estado !== 'On') {
      await this.cerrarSesionCompleta({ sonido: false, redirigir: false });

      return {
        ok: false,
        mensaje:
          'Tu usuario está dado de baja. Contactá al dueño o supervisor.',
      };
    }

    /**
     * La tabla empleados guarda solamente el nombre del archivo:
     *
     * foto = "20-35371754-6.jpg"
     *
     * Acá lo convertimos en la URL pública de Storage.
     */
    let fotoUrl: string | null = null;

    if (data.foto) {
      const { data: publicUrlData } =
        this.supabase.client.storage
          .from('empleado')
          .getPublicUrl(data.foto);

      fotoUrl = publicUrlData.publicUrl;
    }

    const sesion: EmpleadoSesion = {
      id: data.id,
      nombre: data.nombre,
      apellido: data.apellido,
      email: data.email,
      puesto: data.puesto,
      estado: data.estado,
      foto: fotoUrl,
    };

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
    const { data: cliente, error } = await this.supabase.client
      .from('clientes')
      .select('estado')
      .eq('auth_customer_id', authUserId)
      .maybeSingle<{ estado: string }>();

    if (error) {
      console.error('Error buscando cliente:', JSON.stringify(error, null, 2));
      await this.cerrarSesionCompleta({ sonido: false, redirigir: false });
      return { ok: false, mensaje: 'No se pudo validar el usuario. Probá de nuevo.' };
    }

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

    const { data } = await this.supabase.client.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return false;

    const { data: cliente } = await this.supabase.client
      .from('clientes')
      .select('estado')
      .eq('auth_customer_id', userId)
      .maybeSingle<{ estado: string }>();

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
    await this.cerrarSesionCompleta({ sonido: true, redirigir: false });
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
    this.timerExpiracion = setTimeout(() => {
      this.cerrarSesionCompleta({ sonido: true, redirigir: true });
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
      this.reproducirSonidoCierre();
    }
    if (opciones.redirigir) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  private reproducirSonidoCierre(): void {
    try {
      new Audio('assets/sounds/cierre.mp3').play().catch(() => {
        // Reproducción bloqueada por el navegador/WebView — no es crítico.
      });
    } catch {
      // Ídem: nunca debe romper el flujo de cierre de sesión.
    }
  }
}



