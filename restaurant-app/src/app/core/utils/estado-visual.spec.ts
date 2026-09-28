import type { EstadoCliente, EstadoEnEspera } from '../models/cliente.model';
import type { EstadoItem, EstadoPedido } from '../models/pedido.model';
import type { EstadoSolicitudMesa } from '../models/solicitud-mesa.model';
import {
  EstadoVisual,
  estadoCliente,
  estadoEnEspera,
  estadoItem,
  estadoMesa,
  estadoPedido,
  estadoSolicitudMesa,
} from './estado-visual';

/** «Nunca se ve un valor crudo»: un texto con `_` es un valor del código que se coló. */
function esperarSinGuionBajo(visuales: (EstadoVisual | null)[]): void {
  for (const v of visuales) {
    if (v) expect(v.texto).not.toContain('_');
  }
}

describe('estado-visual', () => {
  it('EstadoPedido no muestra valores crudos', () => {
    const valores: EstadoPedido[] = ['pendiente_confirmacion', 'confirmado', 'rechazado'];
    esperarSinGuionBajo(valores.map(estadoPedido));
  });

  it('EstadoItem no muestra valores crudos', () => {
    const valores: EstadoItem[] = ['pendiente', 'en_preparacion', 'listo'];
    esperarSinGuionBajo(valores.map(estadoItem));
  });

  it('EstadoSolicitudMesa no muestra valores crudos', () => {
    const valores: EstadoSolicitudMesa[] = ['en_espera', 'aceptado', 'vinculado', 'rechazado'];
    esperarSinGuionBajo(valores.map(estadoSolicitudMesa));
  });

  it('EstadoEnEspera no muestra valores crudos', () => {
    const valores: EstadoEnEspera[] = ['en_la_lista', 'en_el_salon', 'rechazado'];
    esperarSinGuionBajo(valores.map(estadoEnEspera));
  });

  it('EstadoCliente no muestra valores crudos y el anónimo no lleva chip', () => {
    const valores: EstadoCliente[] = ['pendiente', 'aprobado', 'rechazado'];
    esperarSinGuionBajo(valores.map(estadoCliente));
    expect(estadoCliente('anonimo')).toBeNull();
  });

  it('Mesa: Libre en Listo, Ocupada en Espera', () => {
    expect(estadoMesa('Libre').tono).toBe('listo');
    expect(estadoMesa('Ocupada').tono).toBe('espera');
  });
});
