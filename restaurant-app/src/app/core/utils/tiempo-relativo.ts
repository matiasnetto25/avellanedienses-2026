import { DestroyRef, Signal, inject, signal } from '@angular/core';

const MINUTO_MS = 60_000;

/** "recién", "hace 1 minuto", "hace N minutos" y, pasada la hora, "a las HH:mm". */
export function tiempoRelativo(fechaIso: string, ahora: number): string {
  const fecha = new Date(fechaIso);
  const minutos = Math.floor((ahora - fecha.getTime()) / MINUTO_MS);
  if (minutos < 1) return 'recién';
  if (minutos === 1) return 'hace 1 minuto';
  if (minutos < 60) return `hace ${minutos} minutos`;
  return `a las ${fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** La hora actual, refrescada cada minuto. Se llama en un contexto de inyección (campo de un componente). */
export function relojPorMinuto(): Signal<number> {
  const ahora = signal(Date.now());
  const intervalo = setInterval(() => ahora.set(Date.now()), MINUTO_MS);
  inject(DestroyRef).onDestroy(() => clearInterval(intervalo));
  return ahora.asReadonly();
}
