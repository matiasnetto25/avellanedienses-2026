import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EtapaClienteService } from '../services/etapa-cliente.service';
import { EncuestasService } from '../services/encuestas.service';

/**
 * El formulario de la encuesta (punto 20) se abre una sola vez por estadía:
 * con la encuesta habilitada (EtapaClienteService.encuestaHabilitada) y
 * todavía sin completar. Es lo que impide entrar escribiendo la ruta a
 * mano: la base tiene RLS desactivado, así que la regla de habilitación
 * solo se aplica acá y en el inicio del cliente.
 *
 * Con la encuesta ya completada, sin habilitar, o si falla la consulta,
 * vuelve al inicio del cliente (los resultados se ven solo en la lista de espera).
 */
export const encuestaGuard: CanActivateFn = async () => {
  const etapaCliente = inject(EtapaClienteService);
  const encuestas = inject(EncuestasService);
  const router = inject(Router);

  try {
    await etapaCliente.iniciar();
    const etapa = etapaCliente.etapa();
    if (etapaCliente.encuestaHabilitada() && etapa?.tipo === 'estadia') {
      const resultado = await encuestas.estadiaTieneEncuesta(etapa.solicitud.id);
      if (resultado.ok && !resultado.dato) return true;
    }
  } catch (error) {
    console.error('Error verificando el acceso a la encuesta:', error);
  }

  return router.createUrlTree(['/cliente/inicio']);
};
