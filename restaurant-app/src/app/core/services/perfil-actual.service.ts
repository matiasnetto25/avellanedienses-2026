import { Injectable, inject } from '@angular/core';
import { Auth } from './auth';
import { ClienteAnonimoService } from './cliente-anonimo.service';
import { ClientesService } from './clientes.service';
import { SolicitudesMesaService } from './solicitudes-mesa.service';
import { ETIQUETA_PUESTO } from '../models/empleado.model';
import { nombreCompleto } from '../utils/nombre-completo';

export type TipoPerfil = 'empleado' | 'cliente' | 'cliente-anonimo';

/** Lo que muestran el encabezado, el avatar y la hoja de perfil. */
export interface PerfilActual {
  tipo: TipoPerfil;
  /** Id del empleado o del cliente. */
  id: string;
  nombre: string;
  /** URL pública de la foto, o null (el avatar muestra las iniciales). */
  foto: string | null;
  /** Puesto legible ("Mozo") o "Cliente · Mesa 4". */
  detalle: string;
}

/**
 * Responde "¿quién está usando la app?" para cualquier tipo de usuario, así
 * el encabezado de perfil y la hoja de perfil no repiten el `if` por perfil.
 *
 * Orden: empleado con sesión → cliente anónimo guardado en el dispositivo →
 * cliente registrado con sesión de Auth. El empleado va primero para que un
 * id anónimo viejo en el dispositivo no le gane a la sesión activa.
 */
@Injectable({ providedIn: 'root' })
export class PerfilActualService {
  private readonly auth = inject(Auth);
  private readonly clienteAnonimo = inject(ClienteAnonimoService);
  private readonly clientes = inject(ClientesService);
  private readonly solicitudesMesa = inject(SolicitudesMesaService);

  async obtener(): Promise<PerfilActual | null> {
    const empleado = this.auth.sesion();
    if (empleado) {
      return {
        tipo: 'empleado',
        id: String(empleado.id),
        nombre: nombreCompleto(empleado),
        foto: empleado.foto,
        detalle: ETIQUETA_PUESTO[empleado.puesto],
      };
    }

    const anonimo = await this.clienteAnonimo.obtenerClienteActual();
    if (anonimo) {
      return {
        tipo: 'cliente-anonimo',
        id: anonimo.id,
        nombre: anonimo.nombre,
        foto: anonimo.fotoUrl,
        detalle: await this.detalleCliente(anonimo.id),
      };
    }

    const registrado = await this.clientes.obtenerClienteActual();
    if (registrado) {
      return {
        tipo: 'cliente',
        id: registrado.id,
        nombre: nombreCompleto(registrado),
        foto: this.clientes.obtenerUrlFoto(registrado.foto),
        detalle: await this.detalleCliente(registrado.id),
      };
    }

    return null;
  }

  /** "Cliente · Mesa 4" durante la estadía; "Cliente" fuera de ella. */
  private async detalleCliente(clienteId: string): Promise<string> {
    const solicitud = await this.solicitudesMesa.obtenerMiSolicitud(clienteId);
    return solicitud?.estado === 'vinculado' ? `Cliente · Mesa ${solicitud.numero_mesa}` : 'Cliente';
  }
}
