import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EtapaClienteService } from '../services/etapa-cliente.service';

/**
 * Los juegos (cliente registrado o anónimo) se habilitan cuando el mozo
 * confirma el pedido. Antes de eso, el cliente vuelve a su inicio.
 */
export const juegosGuard: CanActivateFn = async () => {
  const etapa = inject(EtapaClienteService);
  const router = inject(Router);

  try {
    await etapa.iniciar();
    if (etapa.juegosHabilitados()) return true;
  } catch (error) {
    console.error('Error verificando el acceso a los juegos:', error);
  }

  return router.createUrlTree(['/cliente/inicio']);
};