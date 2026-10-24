import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EtapaClienteService } from '../services/etapa-cliente.service';

/**
 * La cuenta (punto 21) se abre solo con la cuenta pedida: pedido en
 * 'cuenta_pedida'. Es lo que impide entrar escribiendo la ruta a mano.
 * En cualquier otro caso, el cliente vuelve a su inicio.
 */
export const cuentaGuard: CanActivateFn = async () => {
  const etapaCliente = inject(EtapaClienteService);
  const router = inject(Router);

  try {
    await etapaCliente.iniciar();
    const etapa = etapaCliente.etapa();
    if (etapa?.tipo === 'estadia' && etapa.pedido?.estado === 'cuenta_pedida') return true;
  } catch (error) {
    console.error('Error verificando el acceso a la cuenta:', error);
  }

  return router.createUrlTree(['/cliente/inicio']);
};
