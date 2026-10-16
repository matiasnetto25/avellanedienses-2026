/**
 * Duración en minutos, siempre con la palabra completa (requisito del
 * trabajo: nunca «min»): «1 minuto», «25 minutos».
 */
export function formatearMinutos(cantidad: number): string {
  return `${cantidad} ${cantidad === 1 ? 'minuto' : 'minutos'}`;
}