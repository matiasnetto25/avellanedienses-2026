
-- Punto 18: finalizar productos de cocina y bar.
-- No ejecutar en producción hasta revisar la migración completa.

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS listo_notificado_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.marcar_item_listo(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empleado_id integer;
  v_puesto text;
  v_pedido_id uuid;
  v_sector text;
  v_estado text;
  v_cliente_id uuid;
  v_mesa_id uuid;
  v_numero_mesa integer;
  v_completo boolean := false;
  v_notificacion_nueva boolean := false;
  v_fecha_notificacion timestamptz;
BEGIN
  -- Validar empleado activo de cocina o bar.
  SELECT e.id, e.puesto
  INTO v_empleado_id, v_puesto
  FROM public.empleados e
  WHERE e.id = public.empleado_id_actual()
    AND e.estado = 'On'
    AND e.puesto IN ('cocinero', 'cantinero');

  IF v_empleado_id IS NULL THEN
    RAISE EXCEPTION 'Se requiere un empleado activo de cocina o bar.';
  END IF;

  -- Identificar el pedido.
  SELECT i.pedido_id
  INTO v_pedido_id
  FROM public.pedido_items i
  WHERE i.id = p_item_id;

  IF v_pedido_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró el producto.';
  END IF;

  -- Bloquear el pedido para serializar finalizaciones simultáneas.
  PERFORM 1
  FROM public.pedidos p
  WHERE p.id = v_pedido_id
    AND p.estado = 'confirmado'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no está confirmado.';
  END IF;

  -- Comprobar el estado y el sector del producto.
  SELECT i.sector, i.estado
  INTO v_sector, v_estado
  FROM public.pedido_items i
  WHERE i.id = p_item_id
    AND i.pedido_id = v_pedido_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el producto del pedido.';
  END IF;

  IF (v_puesto = 'cocinero' AND v_sector <> 'cocina')
     OR (v_puesto = 'cantinero' AND v_sector <> 'bar') THEN
    RAISE EXCEPTION 'No podés finalizar productos de otro sector.';
  END IF;

  IF v_estado <> 'en_preparacion' THEN
    RAISE EXCEPTION 'El producto no está en preparación.';
  END IF;

  UPDATE public.pedido_items
  SET estado = 'listo'
  WHERE id = p_item_id
    AND pedido_id = v_pedido_id
    AND estado = 'en_preparacion';

  -- Solo se completa cuando todos los productos están listos.
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.pedido_items i
    WHERE i.pedido_id = v_pedido_id
      AND i.estado <> 'listo'
  )
  INTO v_completo;

  IF v_completo THEN
    UPDATE public.pedidos p
    SET listo_notificado_at = now()
    WHERE p.id = v_pedido_id
      AND p.listo_notificado_at IS NULL
    RETURNING p.listo_notificado_at
    INTO v_fecha_notificacion;

    v_notificacion_nueva := FOUND;
  END IF;

  SELECT s.cliente_id, s.mesa_id, m.numero_mesa
  INTO v_cliente_id, v_mesa_id, v_numero_mesa
  FROM public.pedidos p
  JOIN public.solicitudes_mesa s ON s.id = p.solicitud_id
  JOIN public.mesa m ON m.id = s.mesa_id
  WHERE p.id = v_pedido_id;

  RETURN jsonb_build_object(
    'ok', true,
    'pedidoId', v_pedido_id,
    'itemListo', true,
    'pedidoCompleto', v_completo,
    'notificacionNueva', v_notificacion_nueva,
    'clienteId', v_cliente_id,
    'mesaId', v_mesa_id,
    'numeroMesa', v_numero_mesa
  );
END;
$$;

REVOKE ALL ON FUNCTION public.marcar_item_listo(uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.marcar_item_listo(uuid)
  TO authenticated;
