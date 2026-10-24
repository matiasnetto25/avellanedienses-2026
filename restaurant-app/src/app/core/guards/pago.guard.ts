import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { EtapaClienteService } from '../services/etapa-cliente.service';

/**
 * Los medios de pago (punto 21) se abren con la cuenta pedida y la propina
 * ya elegida. Sin propina el cliente vuelve a la cuenta; sin cuenta pedida,
 * a su inicio.
 */
export const pagoGuard: CanActivateFn = async () => {
  const etapaCliente = inject(EtapaClienteService);
  const router = inject(Router);

  try {
    await etapaCliente.iniciar();
    const etapa = etapaCliente.etapa();
    if (etapa?.tipo === 'estadia' && etapa.pedido?.estado === 'cuenta_pedida') {
      if (etapa.pedido.propinaPorcentaje !== null) return true;
      return router.createUrlTree(['/cliente/cuenta']);
    }
  } catch (error) {
    console.error('Error verificando el acceso al pago:', error);
  }

  return router.createUrlTree(['/cliente/inicio']);
};
