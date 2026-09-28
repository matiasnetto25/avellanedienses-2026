import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { Auth } from './auth';
import { ClienteAnonimoService } from './cliente-anonimo.service';
import { SolicitudesMesaService } from './solicitudes-mesa.service';
import { NotificacionesService } from './notificaciones.service';
import { LoadingService } from './loading.service';
import { AvisosService } from './avisos.service';
import { EtapaClienteService } from './etapa-cliente.service';
import { PerfilActual } from './perfil-actual.service';

/**
 * Único punto de la app que cierra la sesión, para cualquier perfil.
 * La hoja de perfil llama a salir(perfil) y este servicio decide:
 *
 * - Empleados y cliente registrado: cerrarSesion() (logout de Auth).
 * - Cliente anónimo: cerrarSesionClienteAnonimo(), que borra su cuenta
 *   completa y tiene reglas propias.
 *
 * El token de push del dispositivo lo borra NotificacionesService, que
 * se anota en Auth.alCerrarSesion(): así se borra también cuando la
 * sesión expira sola a la hora, no solo con el botón.
 */
@Injectable({ providedIn: 'root' })
export class SesionService {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly alertController = inject(AlertController);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);
  private readonly notificaciones = inject(NotificacionesService);
  private readonly loading = inject(LoadingService);
  private readonly avisos = inject(AvisosService);
  private readonly etapaCliente = inject(EtapaClienteService);

  async salir(perfil: PerfilActual): Promise<void> {
    if (perfil.tipo === 'cliente-anonimo') {
      await this.cerrarSesionClienteAnonimo(perfil.id, perfil.nombre);
    } else {
      await this.cerrarSesion();
    }
  }

  /** Empleados y cliente registrado. */
  async cerrarSesion(): Promise<void> {
    await this.auth.logout();
    this.irABienvenida();
  }

  /**
   * Cerrar sesión de un cliente anónimo equivale a borrar su cuenta por
   * completo (no tiene contraseña ni nada que "recordar" más allá del
   * id guardado en el dispositivo), por eso se le avisa antes.
   *
   * Si ya está VINCULADO a una mesa (llegó y escaneó su QR), no se lo
   * deja cerrar sesión bajo ninguna circunstancia: tiene que resolverlo
   * en persona en el mostrador, y se le avisa al metre.
   */
  private async cerrarSesionClienteAnonimo(clienteId: string, nombre: string): Promise<void> {
    const solicitud = await this.solicitudesMesa.obtenerMiSolicitud(clienteId);

    if (solicitud?.estado === 'vinculado') {
      await this.bloquearCierre(solicitud.numero_mesa);
      return;
    }

    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: 'Se van a borrar tus datos y vas a tener que volver a ingresar.',
      cssClass: 'merlot-alert',
      buttons: [
        { text: 'Volver', role: 'cancel' },
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          handler: () => {
            void this.eliminarClienteAnonimo(clienteId, nombre);
          },
        },
      ],
    });
    await alert.present();
  }

  private async eliminarClienteAnonimo(clienteId: string, nombre: string): Promise<void> {
    this.loading.mostrar();

    try {
      const resultado = await this.clienteAnonimo.eliminarCuenta(clienteId);

      if (!resultado.ok) {
        if (resultado.bloqueado) {
          // Se coló una vinculación justo en el medio: mismo caso que
          // el chequeo de cerrarSesionClienteAnonimo(), tratado igual.
          await this.bloquearCierre(resultado.numeroMesa);
        } else {
          await this.avisos.error(resultado.mensaje ?? 'No pudimos cerrar tu sesión. Probá de nuevo en un momento.');
        }
        return;
      }

      this.notificaciones.avisarClienteCerroSesion(nombre, resultado.mesaLiberada);
      this.etapaCliente.detener();
      this.irABienvenida();
    } finally {
      this.loading.ocultar();
    }
  }

  private async bloquearCierre(numeroMesa: number | undefined): Promise<void> {
    if (numeroMesa !== undefined) {
      this.notificaciones.avisarCierreSesionBloqueado(numeroMesa);
    }
    await this.avisos.advertencia('Para cerrar sesión, acercate al mostrador.');
  }

  private irABienvenida(): void {
    // replaceUrl: true → el botón "atrás" no puede volver a la pantalla del perfil.
    this.router.navigate(['/bienvenida'], { replaceUrl: true });
  }
}
