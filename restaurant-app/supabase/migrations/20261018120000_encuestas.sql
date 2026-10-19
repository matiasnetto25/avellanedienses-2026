-- =====================================================================
-- Punto 20 · Issue 01 · Encuesta de satisfacción
--
-- Una encuesta por estadía (fila de solicitudes_mesa), con una columna
-- por pregunta. Los check validan cada respuesta y el unique sobre
-- solicitud_id garantiza "una por estadía" aunque se saltee la app.
--
-- Sin cliente_id: la estadía ya conoce al cliente y a la mesa, y se leen
-- con embedding (encuestas → solicitudes_mesa → clientes). Guardarlo
-- duplicaría un dato que la base no puede validar contra la sesión del
-- cliente anónimo, que no tiene usuario de Auth.
--
-- Sin RPC: EncuestasService hace un insert directo y esta política
-- decide qué se acepta:
--   - Solo desde una estadía 'vinculado'.
--   - Solo si esa estadía tiene un pedido que ya pasó la confirmación
--     del mozo. Se escribe como "no está pendiente ni rechazado" para
--     que los estados que agreguen los puntos 16 a 19 sigan habilitando
--     la encuesta. Cuando exista el punto 19 (pedido recibido), esta
--     regla se ajusta junto con EtapaClienteService.encuestaHabilitada.
--
-- Riesgo aceptado (mismo criterio que pedidos_insert_cliente): la base
-- no puede verificar que la estadía sea DEL cliente que inserta, solo
-- que sea una estadía habilitada. El unique limita el daño a una
-- encuesta por estadía.
--
-- Permisos de columna: el front solo puede enviar las respuestas y la
-- estadía. id y created_at los pone la base, así nadie puede fechar una
-- encuesta en otra semana y falsear el gráfico de limpieza por semana.
-- La precarga de datos históricos se hace como postgres, que no tiene
-- esta restricción.
--
-- La encuesta no se edita ni se borra: sin políticas ni permisos de
-- update y delete.
--
-- Lectura pública, incluido el comentario (decisión del equipo): los
-- gráficos los ven clientes anónimos y clientes sin mesa (QR de
-- ingreso, puntos 9 y 22). Los gráficos se calculan en el front.
--
-- Sin Realtime: los resultados se recargan al entrar a la pantalla.
--
-- RLS SIN ACTIVAR: la base del proyecto de prueba tiene RLS desactivado
-- en todas las tablas. Las políticas quedan creadas pero no se aplican
-- hasta que se ejecute "alter table public.encuestas enable row level
-- security" (comentado más abajo). Mientras tanto:
--   - Sí se cumplen: una por estadía (unique), valores válidos (check),
--     created_at puesto por la base y sin update ni delete (permisos de
--     columna, que no dependen de RLS).
--   - NO se cumple en la base: "solo con estadía vinculada y pedido
--     confirmado". Esa regla queda en el front
--     (EtapaClienteService.encuestaHabilitada y encuestaGuard).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table public.encuestas (
  id                   uuid        primary key default gen_random_uuid(),
  -- Sin cascade: las solicitudes no se borran.
  solicitud_id         uuid        not null references public.solicitudes_mesa (id),
  calificacion_general smallint    not null,
  atencion_mozo        text        not null,
  limpieza             smallint    not null,
  aspectos_destacados  text[]      not null,
  recomendaria         boolean     not null,
  comentario           text,
  created_at           timestamptz not null default now(),

  -- Constraints con nombre propio para que el front reconozca el error
  -- y para poder cambiarlos con drop constraint si cambia una pregunta.
  constraint encuestas_solicitud_unica unique (solicitud_id),
  constraint encuestas_calificacion_check
    check (calificacion_general between 1 and 5),
  constraint encuestas_atencion_mozo_check
    check (atencion_mozo in ('excelente', 'buena', 'regular', 'mala')),
  constraint encuestas_limpieza_check
    check (limpieza between 0 and 10),
  -- Al menos un aspecto, y todos de la lista. Los valores van sin tildes;
  -- las etiquetas en español las pone el front (encuesta.model.ts).
  constraint encuestas_aspectos_check
    check (
      cardinality(aspectos_destacados) >= 1
      and aspectos_destacados <@ array[
        'comida', 'bebidas', 'atencion', 'ambiente', 'precio', 'tiempo_espera'
      ]::text[]
    ),
  -- El front guarda null en lugar de un comentario vacío o de espacios.
  constraint encuestas_comentario_check
    check (char_length(comentario) between 1 and 300)
);

-- ---------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------
revoke insert, update, delete on public.encuestas from anon, authenticated;
grant insert (
  solicitud_id,
  calificacion_general,
  atencion_mozo,
  limpieza,
  aspectos_destacados,
  recomendaria,
  comentario
) on public.encuestas to anon, authenticated;

-- ---------------------------------------------------------------------
-- Políticas RLS
-- ---------------------------------------------------------------------
-- Sin activar: ver "RLS SIN ACTIVAR" en el encabezado.
-- alter table public.encuestas enable row level security;

create policy encuestas_select_todos
  on public.encuestas
  for select
  to anon, authenticated
  using (true);

-- Cliente: una encuesta para su estadía vinculada, con el pedido ya
-- confirmado por el mozo. La segunda encuesta de la misma estadía la
-- frena encuestas_solicitud_unica (error 23505).
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
        and p.estado not in ('pendiente_confirmacion', 'rechazado')
    )
  );
