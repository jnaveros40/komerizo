-- Ejecutar después de create_financial_expense_workflow.sql y create_financial_income_workflow.sql.

CREATE TABLE IF NOT EXISTS komerizo_actividades_venta (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  producto_nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  cantidad_inicial INT NOT NULL CHECK (cantidad_inicial > 0),
  precio_unitario DECIMAL(15,2) NOT NULL CHECK (precio_unitario > 0),
  fecha_entrega DATE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'cerrada', 'cancelada')),
  creado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_creador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  cerrado_por BIGINT REFERENCES komerizo_usuarios(id),
  fecha_cierre TIMESTAMPTZ,
  resumen_cierre JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_actividades_venta_estado ON komerizo_actividades_venta(estado);
CREATE INDEX IF NOT EXISTS idx_actividades_venta_fecha_entrega ON komerizo_actividades_venta(fecha_entrega);
ALTER TABLE komerizo_actividades_venta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_activities_public_access ON komerizo_actividades_venta;
CREATE POLICY sales_activities_public_access ON komerizo_actividades_venta FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS komerizo_actividad_venta_egresos (
  actividad_id BIGINT NOT NULL REFERENCES komerizo_actividades_venta(id) ON DELETE CASCADE,
  movimiento_tesoreria_id BIGINT NOT NULL REFERENCES komerizo_tesoreria(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (actividad_id, movimiento_tesoreria_id)
);
ALTER TABLE komerizo_actividad_venta_egresos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sales_activity_expenses_public_access ON komerizo_actividad_venta_egresos;
CREATE POLICY sales_activity_expenses_public_access ON komerizo_actividad_venta_egresos FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS komerizo_ventas_actividad (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actividad_id BIGINT NOT NULL REFERENCES komerizo_actividades_venta(id),
  comprador_usuario_id BIGINT REFERENCES komerizo_usuarios(id),
  numero_documento VARCHAR(50) NOT NULL,
  nombre_comprador VARCHAR(255) NOT NULL,
  celular VARCHAR(50),
  correo VARCHAR(255),
  cantidad INT NOT NULL CHECK (cantidad > 0),
  precio_unitario DECIMAL(15,2) NOT NULL CHECK (precio_unitario > 0),
  total DECIMAL(15,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  estado VARCHAR(30) NOT NULL CHECK (estado IN ('pagada', 'reservada', 'pendiente_pago', 'cancelada')),
  metodo_pago VARCHAR(50),
  tesoreria_movimiento_id BIGINT UNIQUE REFERENCES komerizo_tesoreria(id),
  creado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_creador_id BIGINT REFERENCES komerizo_roles(id),
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  fecha_pago TIMESTAMPTZ,
  fecha_reclamo TIMESTAMPTZ,
  fecha_cancelacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ventas_actividad_actividad ON komerizo_ventas_actividad(actividad_id);
CREATE INDEX IF NOT EXISTS idx_ventas_actividad_documento ON komerizo_ventas_actividad(numero_documento);
CREATE INDEX IF NOT EXISTS idx_ventas_actividad_estado ON komerizo_ventas_actividad(estado);
CREATE INDEX IF NOT EXISTS idx_ventas_actividad_comprador ON komerizo_ventas_actividad(comprador_usuario_id);
ALTER TABLE komerizo_ventas_actividad ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS activity_sales_public_access ON komerizo_ventas_actividad;
CREATE POLICY activity_sales_public_access ON komerizo_ventas_actividad FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION komerizo_crear_actividad_venta(
  p_nombre VARCHAR,
  p_producto_nombre VARCHAR,
  p_descripcion TEXT,
  p_cantidad_inicial INT,
  p_precio_unitario DECIMAL,
  p_fecha_entrega DATE,
  p_egresos BIGINT[],
  p_tesorero_id BIGINT,
  p_tesorero_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_actividad_id BIGINT;
  v_egreso_id BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id
  ) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  IF COALESCE(BTRIM(p_nombre), '') = '' OR COALESCE(BTRIM(p_producto_nombre), '') = '' THEN
    RAISE EXCEPTION 'El nombre y el producto son obligatorios';
  END IF;
  IF p_cantidad_inicial IS NULL OR p_cantidad_inicial <= 0 THEN RAISE EXCEPTION 'La cantidad inicial debe ser mayor que cero'; END IF;
  IF p_precio_unitario IS NULL OR p_precio_unitario <= 0 THEN RAISE EXCEPTION 'El precio debe ser mayor que cero'; END IF;
  IF p_fecha_entrega IS NULL THEN RAISE EXCEPTION 'La fecha de entrega es obligatoria'; END IF;
  IF p_egresos IS NULL OR cardinality(p_egresos) = 0 THEN RAISE EXCEPTION 'Debe asociar al menos un egreso'; END IF;
  IF cardinality(ARRAY(SELECT DISTINCT e FROM unnest(p_egresos) AS e)) <> cardinality(p_egresos) THEN
    RAISE EXCEPTION 'No se pueden repetir egresos asociados';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_egresos) AS requested(id)
    WHERE NOT EXISTS (
      SELECT 1 FROM komerizo_tesoreria t
      WHERE t.id = requested.id AND t.tipo = 'gasto' AND t.estado = 'registrado'
    )
  ) THEN RAISE EXCEPTION 'Todos los egresos asociados deben ser egresos registrados en tesorería'; END IF;

  INSERT INTO komerizo_actividades_venta
    (nombre, producto_nombre, descripcion, cantidad_inicial, precio_unitario, fecha_entrega, creado_por, rol_creador_id)
  VALUES (BTRIM(p_nombre), BTRIM(p_producto_nombre), p_descripcion, p_cantidad_inicial, p_precio_unitario, p_fecha_entrega, p_tesorero_id, p_tesorero_rol_id)
  RETURNING id INTO v_actividad_id;

  FOREACH v_egreso_id IN ARRAY p_egresos LOOP
    INSERT INTO komerizo_actividad_venta_egresos (actividad_id, movimiento_tesoreria_id)
    VALUES (v_actividad_id, v_egreso_id);
  END LOOP;
  RETURN v_actividad_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_registrar_venta_producto(
  p_actividad_id BIGINT,
  p_comprador_usuario_id BIGINT,
  p_numero_documento VARCHAR,
  p_nombre_comprador VARCHAR,
  p_celular VARCHAR,
  p_correo VARCHAR,
  p_cantidad INT,
  p_estado_inicial VARCHAR,
  p_metodo_pago VARCHAR,
  p_tesorero_id BIGINT,
  p_tesorero_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_activity komerizo_actividades_venta%ROWTYPE;
  v_buyer komerizo_usuarios%ROWTYPE;
  v_sale komerizo_ventas_actividad%ROWTYPE;
  v_allocated BIGINT;
  v_movement_id BIGINT;
  v_document VARCHAR(50);
  v_name VARCHAR(255);
  v_phone VARCHAR(50);
  v_email VARCHAR(255);
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id
  ) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  IF p_estado_inicial NOT IN ('pagada', 'reservada') THEN RAISE EXCEPTION 'El estado inicial no es válido'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
  IF p_estado_inicial = 'pagada' AND COALESCE(BTRIM(p_metodo_pago), '') = '' THEN RAISE EXCEPTION 'El método de pago es obligatorio'; END IF;

  SELECT * INTO v_activity FROM komerizo_actividades_venta WHERE id = p_actividad_id FOR UPDATE;
  IF NOT FOUND OR v_activity.estado <> 'abierta' THEN RAISE EXCEPTION 'La actividad no está abierta'; END IF;
  SELECT COALESCE(SUM(cantidad), 0) INTO v_allocated
  FROM komerizo_ventas_actividad
  WHERE actividad_id = v_activity.id AND estado IN ('pagada', 'reservada', 'pendiente_pago');
  IF p_cantidad > v_activity.cantidad_inicial - v_allocated THEN RAISE EXCEPTION 'No hay suficientes unidades disponibles'; END IF;

  IF p_comprador_usuario_id IS NOT NULL THEN
    SELECT * INTO v_buyer FROM komerizo_usuarios WHERE id = p_comprador_usuario_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'El comprador afiliado no existe'; END IF;
    v_document := v_buyer.cc;
    v_name := BTRIM(COALESCE(v_buyer.nombre, '') || ' ' || COALESCE(v_buyer.apellido, ''));
    v_phone := v_buyer.telefono;
    v_email := v_buyer.correo_electronico;
  ELSE
    v_document := BTRIM(p_numero_documento);
    v_name := BTRIM(p_nombre_comprador);
    v_phone := p_celular;
    v_email := p_correo;
    IF COALESCE(v_document, '') = '' OR COALESCE(v_name, '') = '' THEN RAISE EXCEPTION 'Documento y nombre del comprador son obligatorios'; END IF;
  END IF;

  INSERT INTO komerizo_ventas_actividad
    (actividad_id, comprador_usuario_id, numero_documento, nombre_comprador, celular, correo,
     cantidad, precio_unitario, estado, metodo_pago, creado_por, rol_creador_id)
  VALUES (v_activity.id, p_comprador_usuario_id, v_document, v_name, v_phone, v_email,
          p_cantidad, v_activity.precio_unitario, p_estado_inicial,
          CASE WHEN p_estado_inicial = 'pagada' THEN p_metodo_pago ELSE NULL END,
          p_tesorero_id, p_tesorero_rol_id)
  RETURNING * INTO v_sale;

  IF p_estado_inicial = 'pagada' THEN
    v_movement_id := komerizo_registrar_ingreso_financiero(
      v_sale.total,
      'Venta de ' || v_activity.producto_nombre || ' - Actividad #' || v_activity.id,
      'VENTA-' || v_sale.id,
      p_metodo_pago,
      'venta_producto',
      v_sale.id,
      p_tesorero_id,
      p_tesorero_rol_id
    );
    UPDATE komerizo_ventas_actividad
    SET tesoreria_movimiento_id = v_movement_id, fecha_pago = NOW(), updated_at = NOW()
    WHERE id = v_sale.id;
  END IF;
  RETURN v_sale.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_reservar_producto_afiliado(
  p_actividad_id BIGINT, p_usuario_id BIGINT, p_cantidad INT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_activity komerizo_actividades_venta%ROWTYPE;
  v_user komerizo_usuarios%ROWTYPE;
  v_allocated BIGINT;
  v_sale_id BIGINT;
  v_name VARCHAR(255);
BEGIN
  SELECT * INTO v_user FROM komerizo_usuarios WHERE id = p_usuario_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'El usuario no existe'; END IF;
  IF v_user.estado <> 'activo' THEN RAISE EXCEPTION 'Solo los afiliados activos pueden reservar productos'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_usuario_roles ur
    JOIN komerizo_roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = p_usuario_id AND r.nombre = 'Usuario'
  ) THEN RAISE EXCEPTION 'El usuario no tiene un perfil de afiliado válido'; END IF;
  SELECT * INTO v_activity FROM komerizo_actividades_venta WHERE id = p_actividad_id FOR UPDATE;
  IF NOT FOUND OR v_activity.estado <> 'abierta' THEN RAISE EXCEPTION 'La actividad no está abierta'; END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN RAISE EXCEPTION 'La cantidad debe ser mayor que cero'; END IF;
  SELECT COALESCE(SUM(cantidad), 0) INTO v_allocated FROM komerizo_ventas_actividad
  WHERE actividad_id = v_activity.id AND estado IN ('pagada', 'reservada', 'pendiente_pago');
  IF p_cantidad > v_activity.cantidad_inicial - v_allocated THEN RAISE EXCEPTION 'No hay suficientes unidades disponibles'; END IF;
  v_name := BTRIM(COALESCE(v_user.nombre, '') || ' ' || COALESCE(v_user.apellido, ''));
  INSERT INTO komerizo_ventas_actividad
    (actividad_id, comprador_usuario_id, numero_documento, nombre_comprador, celular, correo,
     cantidad, precio_unitario, estado, creado_por, rol_creador_id)
  VALUES (v_activity.id, p_usuario_id, v_user.cc, v_name, v_user.telefono, v_user.correo_electronico,
          p_cantidad, v_activity.precio_unitario, 'reservada', p_usuario_id, NULL)
  RETURNING id INTO v_sale_id;
  RETURN v_sale_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_cobrar_venta_pendiente(
  p_venta_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT, p_metodo_pago VARCHAR
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_sale komerizo_ventas_actividad%ROWTYPE;
  v_activity komerizo_actividades_venta%ROWTYPE;
  v_movement_id BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id
  ) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_sale FROM komerizo_ventas_actividad WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La venta no existe'; END IF;
  SELECT * INTO v_activity FROM komerizo_actividades_venta WHERE id = v_sale.actividad_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La actividad no existe'; END IF;
  IF v_sale.estado <> 'pendiente_pago' THEN RAISE EXCEPTION 'La venta no está pendiente de pago'; END IF;
  IF v_activity.estado NOT IN ('abierta', 'cerrada') THEN RAISE EXCEPTION 'La actividad no permite cobrar esta venta'; END IF;
  IF COALESCE(BTRIM(p_metodo_pago), '') = '' THEN RAISE EXCEPTION 'El método de pago es obligatorio'; END IF;
  v_movement_id := komerizo_registrar_ingreso_financiero(
    v_sale.total,
    'Cobro pendiente de venta de ' || v_activity.producto_nombre || ' - Actividad #' || v_activity.id,
    'VENTA-' || v_sale.id,
    p_metodo_pago,
    'venta_producto',
    v_sale.id,
    p_tesorero_id,
    p_tesorero_rol_id
  );
  UPDATE komerizo_ventas_actividad
  SET estado = 'pagada', metodo_pago = p_metodo_pago,
      tesoreria_movimiento_id = v_movement_id, fecha_pago = NOW(), updated_at = NOW()
  WHERE id = v_sale.id;
  RETURN v_movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_pagar_reserva_producto(
  p_venta_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT, p_metodo_pago VARCHAR
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_sale komerizo_ventas_actividad%ROWTYPE;
  v_activity komerizo_actividades_venta%ROWTYPE;
  v_movement_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_sale FROM komerizo_ventas_actividad WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La venta no existe'; END IF;
  SELECT * INTO v_activity FROM komerizo_actividades_venta WHERE id = v_sale.actividad_id FOR UPDATE;
  IF v_sale.estado <> 'reservada' OR v_activity.estado <> 'abierta' THEN RAISE EXCEPTION 'La reserva no puede pagarse'; END IF;
  IF COALESCE(BTRIM(p_metodo_pago), '') = '' THEN RAISE EXCEPTION 'El método de pago es obligatorio'; END IF;
  v_movement_id := komerizo_registrar_ingreso_financiero(v_sale.total, 'Venta de ' || v_activity.producto_nombre || ' - Actividad #' || v_activity.id, 'VENTA-' || v_sale.id, p_metodo_pago, 'venta_producto', v_sale.id, p_tesorero_id, p_tesorero_rol_id);
  UPDATE komerizo_ventas_actividad SET estado = 'pagada', metodo_pago = p_metodo_pago, tesoreria_movimiento_id = v_movement_id, fecha_pago = NOW(), updated_at = NOW() WHERE id = v_sale.id;
  RETURN v_movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_marcar_producto_pendiente_pago(
  p_venta_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_sale komerizo_ventas_actividad%ROWTYPE; v_activity komerizo_actividades_venta%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_sale FROM komerizo_ventas_actividad WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La venta no existe'; END IF;
  SELECT * INTO v_activity FROM komerizo_actividades_venta WHERE id = v_sale.actividad_id FOR UPDATE;
  IF v_sale.estado <> 'reservada' OR v_activity.estado <> 'abierta' THEN RAISE EXCEPTION 'La reserva no puede marcarse como pendiente de pago'; END IF;
  UPDATE komerizo_ventas_actividad SET estado = 'pendiente_pago', fecha_reclamo = NOW(), updated_at = NOW() WHERE id = v_sale.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_cancelar_reserva_producto(
  p_venta_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_sale komerizo_ventas_actividad%ROWTYPE; v_activity komerizo_actividades_venta%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_sale FROM komerizo_ventas_actividad WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La venta no existe'; END IF;
  SELECT * INTO v_activity FROM komerizo_actividades_venta WHERE id = v_sale.actividad_id FOR UPDATE;
  IF v_sale.estado <> 'reservada' OR v_activity.estado <> 'abierta' THEN RAISE EXCEPTION 'La reserva no puede cancelarse'; END IF;
  UPDATE komerizo_ventas_actividad SET estado = 'cancelada', fecha_cancelacion = NOW(), updated_at = NOW() WHERE id = v_sale.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_cerrar_actividad_venta(
  p_actividad_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_activity komerizo_actividades_venta%ROWTYPE;
  v_paid BIGINT := 0; v_pending BIGINT := 0; v_reserved BIGINT := 0; v_cancelled BIGINT := 0;
  v_income DECIMAL(15,2) := 0; v_receivable DECIMAL(15,2) := 0; v_reserved_value DECIMAL(15,2) := 0;
  v_expenses DECIMAL(15,2) := 0; v_assigned BIGINT; v_unassigned BIGINT;
  v_summary JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_activity FROM komerizo_actividades_venta WHERE id = p_actividad_id FOR UPDATE;
  IF NOT FOUND OR v_activity.estado <> 'abierta' THEN RAISE EXCEPTION 'La actividad no está abierta'; END IF;
  SELECT
    COALESCE(SUM(cantidad) FILTER (WHERE estado = 'pagada'), 0),
    COALESCE(SUM(cantidad) FILTER (WHERE estado = 'pendiente_pago'), 0),
    COALESCE(SUM(cantidad) FILTER (WHERE estado = 'reservada'), 0),
    COALESCE(SUM(cantidad) FILTER (WHERE estado = 'cancelada'), 0),
    COALESCE(SUM(total) FILTER (WHERE estado = 'pagada'), 0),
    COALESCE(SUM(total) FILTER (WHERE estado = 'pendiente_pago'), 0),
    COALESCE(SUM(total) FILTER (WHERE estado = 'reservada'), 0)
  INTO v_paid, v_pending, v_reserved, v_cancelled, v_income, v_receivable, v_reserved_value
  FROM komerizo_ventas_actividad WHERE actividad_id = v_activity.id;
  SELECT COALESCE(SUM(t.cantidad), 0) INTO v_expenses
  FROM komerizo_actividad_venta_egresos ae JOIN komerizo_tesoreria t ON t.id = ae.movimiento_tesoreria_id
  WHERE ae.actividad_id = v_activity.id;
  v_assigned := v_paid + v_pending + v_reserved;
  v_unassigned := v_activity.cantidad_inicial - v_assigned;
  v_summary := jsonb_build_object(
    'cantidad_inicial', v_activity.cantidad_inicial,
    'unidades_pagadas', v_paid,
    'unidades_pendientes_pago', v_pending,
    'unidades_reservadas_no_reportadas', v_reserved,
    'unidades_canceladas', v_cancelled,
    'unidades_asignadas', v_assigned,
    'unidades_sin_asignar', v_unassigned,
    'ingresos_pagados', v_income,
    'cartera_pendiente', v_receivable,
    'valor_reservas_no_reportadas', v_reserved_value,
    'unidades_perdida_reservas', v_reserved,
    'valor_perdida_reservas', v_reserved_value,
    'egresos_asociados', v_expenses,
    'resultado_caja', v_income - v_expenses
  );
  UPDATE komerizo_actividades_venta SET estado = 'cerrada', cerrado_por = p_tesorero_id, fecha_cierre = NOW(), resumen_cierre = v_summary, updated_at = NOW() WHERE id = v_activity.id;
  RETURN v_summary;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_listar_actividades_venta()
RETURNS TABLE (
  id BIGINT, nombre VARCHAR, producto_nombre VARCHAR, descripcion TEXT,
  precio_unitario DECIMAL, fecha_entrega DATE, cantidad_inicial INT, cantidad_disponible BIGINT
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT a.id, a.nombre, a.producto_nombre, a.descripcion, a.precio_unitario, a.fecha_entrega, a.cantidad_inicial,
    (a.cantidad_inicial - COALESCE((SELECT SUM(v.cantidad) FROM komerizo_ventas_actividad v WHERE v.actividad_id = a.id AND v.estado IN ('pagada', 'reservada', 'pendiente_pago')), 0))::BIGINT
  FROM komerizo_actividades_venta a
  WHERE a.estado = 'abierta'
  ORDER BY a.fecha_entrega ASC;
END;
$$;
