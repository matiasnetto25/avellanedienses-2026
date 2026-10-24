-- =====================================================================
-- Punto 20 · La encuesta se habilita con el pedido entregado
--
-- Antes alcanzaba con que el mozo confirmara el pedido. Ahora el cliente
-- solo puede completar la encuesta cuando ya recibió el pedido (punto
-- 19): estado 'entregado' o posterior ('cuenta_pedida'). Los estados
-- que sumen los puntos 21 y 22 y vengan después de la entrega tienen que
-- agregarse acá y en pedidoEntregado() (pedido.model.ts).
--
-- RLS: la base de prueba lo tiene desactivado, así que esta regla rige
-- en el front (EtapaClienteService.encuestaHabilitada y encuestaGuard).
-- La política queda actualizada para cuando se active.
-- =====================================================================

drop policy encuestas_insert_cliente on public.encuestas;

create policy encuestas_insert_cliente
  on public.encuestas
  for insert
  to anon, authenticated
  with check (
    exists (
      select 1
      from public.solicitudes_mesa s
      join public.pedidos p on p.solicitud_id = s.id
      where s.id = encuestas.solicitud_id
        and s.estado = 'vinculado'
        and p.estado in ('entregado', 'cuenta_pedida')
    )
  );
