-- Ejecutar después de create_financial_expense_workflow.sql.

ALTER TABLE IF EXISTS komerizo_tesoreria
  ADD COLUMN IF NOT EXISTS origen_tipo VARCHAR(50),
  ADD COLUMN IF NOT EXISTS origen_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tesoreria_origen
  ON komerizo_tesoreria(origen_tipo, origen_id)
  WHERE origen_tipo IS NOT NULL AND origen_id IS NOT NULL;

ALTER TABLE IF EXISTS komerizo_alquileres
  ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(20) DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50),
  ADD COLUMN IF NOT EXISTS tesoreria_movimiento_id BIGINT REFERENCES komerizo_tesoreria(id),
  ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMPTZ;
UPDATE komerizo_alquileres SET estado_pago = CASE WHEN valor_total = 0 THEN 'exonerado' ELSE 'pendiente' END
WHERE estado_pago IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_alquileres_tesoreria_movimiento
  ON komerizo_alquileres(tesoreria_movimiento_id)
  WHERE tesoreria_movimiento_id IS NOT NULL;

CREATE OR REPLACE FUNCTION komerizo_registrar_ingreso_financiero(
  p_monto DECIMAL, p_descripcion TEXT, p_referencia VARCHAR,
  p_metodo_pago VARCHAR, p_origen_tipo VARCHAR, p_origen_id BIGINT,
  p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_saldo komerizo_tesoreria_saldo%ROWTYPE;
  v_saldo_anterior DECIMAL(15,2);
  v_saldo_nuevo DECIMAL(15,2);
  v_id BIGINT;
BEGIN
  IF p_monto IS NULL OR p_monto <= 0 THEN RAISE EXCEPTION 'El monto debe ser mayor que cero'; END IF;
  IF COALESCE(BTRIM(p_descripcion), '') = '' THEN RAISE EXCEPTION 'La descripción es obligatoria'; END IF;
  IF COALESCE(BTRIM(p_origen_tipo), '') = '' OR p_origen_id IS NULL THEN
    RAISE EXCEPTION 'El origen del ingreso es obligatorio';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id
  ) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  IF EXISTS (SELECT 1 FROM komerizo_tesoreria WHERE origen_tipo = p_origen_tipo
             AND origen_id = p_origen_id AND estado = 'registrado') THEN
    RAISE EXCEPTION 'El ingreso ya fue registrado';
  END IF;

  SELECT * INTO v_saldo FROM komerizo_tesoreria_saldo
  ORDER BY id DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO komerizo_tesoreria_saldo (saldo_actual, saldo_anterior, actualizado_por)
    VALUES (0, 0, p_tesorero_id) RETURNING * INTO v_saldo;
  END IF;
  v_saldo_anterior := v_saldo.saldo_actual;
  v_saldo_nuevo := v_saldo_anterior + p_monto;

  INSERT INTO komerizo_tesoreria
    (tipo, cantidad, descripcion, saldo_anterior, saldo_nuevo, justificacion,
     referencia_externa, metodo_pago, usuario_id, rol_id, estado,
     origen_tipo, origen_id, fecha_movimiento)
  VALUES ('ingreso', p_monto, p_descripcion, v_saldo_anterior, v_saldo_nuevo,
          NULL, p_referencia, p_metodo_pago, p_tesorero_id, p_tesorero_rol_id,
          'registrado', p_origen_tipo, p_origen_id, CURRENT_DATE)
  RETURNING id INTO v_id;

  UPDATE komerizo_tesoreria_saldo
  SET saldo_anterior = v_saldo_anterior, saldo_actual = v_saldo_nuevo,
      actualizado_por = p_tesorero_id, fecha_actualizacion = NOW()
  WHERE id = v_saldo.id;
  INSERT INTO komerizo_tesoreria_historial
    (movimiento_id, tipo_cambio, valor_anterior, valor_nuevo, razon, usuario_id)
  VALUES (v_id, 'registro_ingreso', jsonb_build_object('saldo_actual', v_saldo_anterior),
          jsonb_build_object('saldo_actual', v_saldo_nuevo), p_descripcion, p_tesorero_id);
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_confirmar_pago_salon(
  p_alquiler_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT,
  p_metodo_pago VARCHAR
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_alquiler komerizo_alquileres%ROWTYPE; v_mov BIGINT;
BEGIN
  SELECT * INTO v_alquiler FROM komerizo_alquileres WHERE id = p_alquiler_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe'; END IF;
  IF v_alquiler.estado = 'cancelado' OR v_alquiler.estado_pago <> 'pendiente' OR v_alquiler.valor_total <= 0 THEN
    RAISE EXCEPTION 'La reserva no está pendiente de pago';
  END IF;
  v_mov := komerizo_registrar_ingreso_financiero(v_alquiler.valor_total,
    'Alquiler salón comunal #' || v_alquiler.id, 'SALON-' || v_alquiler.id,
    p_metodo_pago, 'salon', v_alquiler.id, p_tesorero_id, p_tesorero_rol_id);
  UPDATE komerizo_alquileres SET estado_pago = 'completado', metodo_pago = p_metodo_pago,
    tesoreria_movimiento_id = v_mov, fecha_pago = NOW(), actualizado_at = NOW()
  WHERE id = v_alquiler.id;
  RETURN v_mov;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_marcar_salon_consumo_interno(
  p_alquiler_id BIGINT, p_tesorero_id BIGINT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_estado_pago VARCHAR(20); v_estado VARCHAR(20);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_usuario_roles ur
    JOIN komerizo_roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = p_tesorero_id
      AND r.nombre = 'Tesorero'
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;

  SELECT estado_pago, estado INTO v_estado_pago, v_estado FROM komerizo_alquileres WHERE id = p_alquiler_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La reserva no existe'; END IF;
  IF v_estado <> 'confirmado' THEN RAISE EXCEPTION 'La reserva no está confirmada'; END IF;
  IF v_estado_pago = 'completado' THEN RAISE EXCEPTION 'Una reserva pagada no puede convertirse en consumo interno'; END IF;
  IF v_estado_pago <> 'pendiente' THEN RAISE EXCEPTION 'La reserva no está pendiente'; END IF;
  UPDATE komerizo_alquileres SET valor_total = 0, estado_pago = 'exonerado', metodo_pago = NULL,
    fecha_pago = NOW(), actualizado_at = NOW() WHERE id = p_alquiler_id;
END;
$$;

CREATE TABLE IF NOT EXISTS komerizo_alquiler_recursos (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  creado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_creador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  tipo_arrendatario VARCHAR(20) NOT NULL CHECK (tipo_arrendatario IN ('afiliado','externo','comunal')),
  usuario_arrendatario_id BIGINT REFERENCES komerizo_usuarios(id),
  numero_documento VARCHAR(50) NOT NULL, nombres VARCHAR(150) NOT NULL, apellidos VARCHAR(150),
  direccion VARCHAR(255), celular VARCHAR(50), correo VARCHAR(255),
  fecha_inicio DATE NOT NULL, fecha_fin DATE NOT NULL,
  valor_alquiler DECIMAL(15,2) NOT NULL DEFAULT 0, deposito_garantia DECIMAL(15,2) NOT NULL DEFAULT 0,
  estado_deposito VARCHAR(30) NOT NULL DEFAULT 'no_aplica' CHECK (estado_deposito IN ('no_aplica','pendiente','recibido','devuelto','aplicado_danos')),
  exonerado_pago BOOLEAN NOT NULL DEFAULT FALSE, justificacion_exoneracion TEXT,
  estado_pago VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente','completado','exonerado')),
  estado_alquiler VARCHAR(30) NOT NULL DEFAULT 'pendiente' CHECK (estado_alquiler IN ('pendiente','activo','completado','cancelado')),
  metodo_pago VARCHAR(50), clausulas_uso TEXT NOT NULL,
  tesoreria_movimiento_id BIGINT REFERENCES komerizo_tesoreria(id),
  deposito_movimiento_id BIGINT REFERENCES komerizo_tesoreria(id),
  observacion_cierre TEXT, fecha_pago TIMESTAMPTZ, fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio), CHECK (deposito_garantia >= 0)
);
CREATE TABLE IF NOT EXISTS komerizo_alquiler_recursos_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alquiler_id BIGINT NOT NULL REFERENCES komerizo_alquiler_recursos(id) ON DELETE CASCADE,
  inventario_id BIGINT NOT NULL REFERENCES komerizo_inventario(id),
  cantidad_alquilada DECIMAL(10,2) NOT NULL, valor_unitario DECIMAL(15,2) NOT NULL,
  valor_total DECIMAL(15,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (cantidad_alquilada > 0), CHECK (valor_unitario >= 0), CHECK (valor_total >= 0)
);
CREATE INDEX IF NOT EXISTS idx_alquiler_recursos_fechas ON komerizo_alquiler_recursos(fecha_inicio, fecha_fin);
CREATE INDEX IF NOT EXISTS idx_alquiler_recursos_estado ON komerizo_alquiler_recursos(estado_alquiler, estado_pago);
CREATE INDEX IF NOT EXISTS idx_alquiler_recursos_items_alquiler ON komerizo_alquiler_recursos_items(alquiler_id);
CREATE INDEX IF NOT EXISTS idx_alquiler_recursos_items_inventario ON komerizo_alquiler_recursos_items(inventario_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alquiler_recursos_movimiento ON komerizo_alquiler_recursos(tesoreria_movimiento_id) WHERE tesoreria_movimiento_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_alquiler_recursos_deposito_movimiento ON komerizo_alquiler_recursos(deposito_movimiento_id) WHERE deposito_movimiento_id IS NOT NULL;
ALTER TABLE komerizo_alquiler_recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_alquiler_recursos_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_resource_rentals_public_access ON komerizo_alquiler_recursos;
CREATE POLICY financial_resource_rentals_public_access ON komerizo_alquiler_recursos FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS financial_resource_rental_items_public_access ON komerizo_alquiler_recursos_items;
CREATE POLICY financial_resource_rental_items_public_access ON komerizo_alquiler_recursos_items FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION komerizo_crear_alquiler_recursos(
  p_creado_por BIGINT, p_rol_creador_id BIGINT, p_tipo_arrendatario VARCHAR,
  p_usuario_arrendatario_id BIGINT, p_numero_documento VARCHAR, p_nombres VARCHAR,
  p_apellidos VARCHAR, p_direccion VARCHAR, p_celular VARCHAR, p_correo VARCHAR,
  p_fecha_inicio DATE, p_fecha_fin DATE, p_deposito_garantia DECIMAL,
  p_clausulas_uso TEXT, p_exonerado_pago BOOLEAN, p_justificacion_exoneracion TEXT,
  p_items JSONB
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_rental_id BIGINT; v_item JSONB; v_inventory komerizo_inventario%ROWTYPE;
  v_qty DECIMAL; v_reserved DECIMAL; v_salon_reserved DECIMAL; v_total DECIMAL(15,2) := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_rol_creador_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_creado_por) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;
  IF p_tipo_arrendatario NOT IN ('afiliado','externo','comunal') THEN RAISE EXCEPTION 'Tipo de arrendatario inválido'; END IF;
  IF COALESCE(BTRIM(p_numero_documento), '') = '' OR COALESCE(BTRIM(p_nombres), '') = '' THEN RAISE EXCEPTION 'Documento y nombres son obligatorios'; END IF;
  IF p_fecha_fin < p_fecha_inicio THEN RAISE EXCEPTION 'El rango de fechas es inválido'; END IF;
  IF p_deposito_garantia IS NULL OR p_deposito_garantia < 0 THEN RAISE EXCEPTION 'El depósito no puede ser negativo'; END IF;
  IF COALESCE(BTRIM(p_clausulas_uso), '') = '' THEN RAISE EXCEPTION 'Las cláusulas de uso son obligatorias'; END IF;
  IF COALESCE(jsonb_typeof(p_items), '') <> 'array' OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Debe seleccionar al menos un recurso'; END IF;
  IF p_exonerado_pago AND (COALESCE(BTRIM(p_justificacion_exoneracion), '') = '' OR p_deposito_garantia <> 0) THEN
    RAISE EXCEPTION 'La exoneración requiere justificación y depósito en cero';
  END IF;

  PERFORM pg_advisory_xact_lock(42001001);

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_inventory FROM komerizo_inventario WHERE id = (v_item->>'inventario_id')::BIGINT FOR UPDATE;
    IF NOT FOUND OR NOT COALESCE(v_inventory.es_alquilable, false) OR v_inventory.estado <> 'activo' THEN
      RAISE EXCEPTION 'El recurso no está disponible para alquiler';
    END IF;
    v_qty := (v_item->>'cantidad')::DECIMAL;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'La cantidad solicitada debe ser mayor que cero'; END IF;
    SELECT COALESCE(SUM(i.cantidad_alquilada), 0) INTO v_reserved
    FROM komerizo_alquiler_recursos_items i JOIN komerizo_alquiler_recursos a ON a.id = i.alquiler_id
    WHERE i.inventario_id = v_inventory.id AND a.estado_alquiler IN ('pendiente','activo')
      AND a.fecha_inicio <= p_fecha_fin AND a.fecha_fin >= p_fecha_inicio;
    SELECT COALESCE(SUM(i.cantidad_alquilada), 0) INTO v_salon_reserved
    FROM komerizo_alquiler_items i
    JOIN komerizo_alquileres a ON a.id = i.alquiler_id
    WHERE i.inventario_id = v_inventory.id
      AND a.estado = 'confirmado'
      AND a.fecha_inicio <= p_fecha_fin
      AND COALESCE(a.fecha_fin, a.fecha_inicio) >= p_fecha_inicio;
    v_reserved := v_reserved + v_salon_reserved;
    IF v_qty > v_inventory.cantidad - v_reserved THEN RAISE EXCEPTION 'Cantidad no disponible para el rango seleccionado'; END IF;
    v_total := v_total + v_qty * COALESCE(v_inventory.valor_alquiler, 0);
  END LOOP;
  IF NOT p_exonerado_pago AND v_total <= 0 THEN RAISE EXCEPTION 'El valor del alquiler debe ser mayor que cero'; END IF;

  INSERT INTO komerizo_alquiler_recursos
    (creado_por, rol_creador_id, tipo_arrendatario, usuario_arrendatario_id, numero_documento, nombres,
     apellidos, direccion, celular, correo, fecha_inicio, fecha_fin, valor_alquiler, deposito_garantia,
     estado_deposito, exonerado_pago, justificacion_exoneracion, estado_pago, estado_alquiler,
     clausulas_uso)
  VALUES (p_creado_por, p_rol_creador_id, p_tipo_arrendatario, p_usuario_arrendatario_id, p_numero_documento,
     p_nombres, p_apellidos, p_direccion, p_celular, p_correo, p_fecha_inicio, p_fecha_fin, v_total,
     p_deposito_garantia, CASE WHEN p_deposito_garantia = 0 THEN 'no_aplica' ELSE 'pendiente' END,
     p_exonerado_pago, p_justificacion_exoneracion, CASE WHEN p_exonerado_pago THEN 'exonerado' ELSE 'pendiente' END,
     CASE WHEN p_exonerado_pago THEN 'activo' ELSE 'pendiente' END, p_clausulas_uso)
  RETURNING id INTO v_rental_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_inventory FROM komerizo_inventario WHERE id = (v_item->>'inventario_id')::BIGINT;
    v_qty := (v_item->>'cantidad')::DECIMAL;
    INSERT INTO komerizo_alquiler_recursos_items (alquiler_id, inventario_id, cantidad_alquilada, valor_unitario, valor_total)
    VALUES (v_rental_id, v_inventory.id, v_qty, COALESCE(v_inventory.valor_alquiler, 0), v_qty * COALESCE(v_inventory.valor_alquiler, 0));
  END LOOP;
  RETURN v_rental_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_confirmar_pago_alquiler_recursos(
  p_alquiler_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT, p_metodo_pago VARCHAR
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_rental komerizo_alquiler_recursos%ROWTYPE; v_mov BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;
  SELECT * INTO v_rental FROM komerizo_alquiler_recursos WHERE id = p_alquiler_id FOR UPDATE;
  IF NOT FOUND OR v_rental.estado_alquiler <> 'pendiente' OR v_rental.estado_pago <> 'pendiente'
     OR v_rental.exonerado_pago OR v_rental.valor_alquiler <= 0 THEN RAISE EXCEPTION 'El alquiler no está pendiente de pago'; END IF;
  v_mov := komerizo_registrar_ingreso_financiero(v_rental.valor_alquiler,
    'Alquiler de recursos físicos #' || v_rental.id, 'RECURSOS-' || v_rental.id,
    p_metodo_pago, 'alquiler_recursos', v_rental.id, p_tesorero_id, p_tesorero_rol_id);
  UPDATE komerizo_alquiler_recursos SET estado_pago = 'completado', estado_alquiler = 'activo',
    metodo_pago = p_metodo_pago, tesoreria_movimiento_id = v_mov, fecha_pago = NOW(),
    estado_deposito = CASE WHEN deposito_garantia > 0 THEN 'recibido' ELSE 'no_aplica' END, updated_at = NOW()
  WHERE id = v_rental.id;
  RETURN v_mov;
END;
$$;

DROP FUNCTION IF EXISTS komerizo_cancelar_alquiler_recursos(BIGINT, BIGINT);
DROP FUNCTION IF EXISTS komerizo_cancelar_alquiler_recursos(BIGINT, BIGINT, BIGINT);

CREATE OR REPLACE FUNCTION komerizo_cancelar_alquiler_recursos(
  p_alquiler_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_rental komerizo_alquiler_recursos%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id
      AND r.nombre = 'Tesorero'
      AND ur.usuario_id = p_tesorero_id
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;

  SELECT * INTO v_rental
  FROM komerizo_alquiler_recursos
  WHERE id = p_alquiler_id
  FOR UPDATE;
  IF NOT FOUND OR v_rental.tesoreria_movimiento_id IS NOT NULL
     OR v_rental.estado_alquiler NOT IN ('pendiente', 'activo') THEN
    RAISE EXCEPTION 'El alquiler no puede cancelarse';
  END IF;

  UPDATE komerizo_alquiler_recursos
  SET estado_alquiler = 'cancelado', updated_at = NOW()
  WHERE id = v_rental.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_crear_reserva_salon(
  p_usuario_id BIGINT,
  p_rol_id BIGINT,
  p_tipo_alquiler VARCHAR,
  p_fecha_inicio DATE,
  p_fecha_fin DATE,
  p_hora_inicio TIME,
  p_hora_fin TIME,
  p_motivo TEXT,
  p_items JSONB
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_config komerizo_salon_config%ROWTYPE;
  v_item JSONB;
  v_inventory komerizo_inventario%ROWTYPE;
  v_alquiler_id BIGINT;
  v_qty INT;
  v_reserved DECIMAL;
  v_duration_minutes NUMERIC;
  v_billable_hours INT;
  v_number_of_days INT;
  v_total_salon DECIMAL(15,2);
  v_total_items DECIMAL(15,2) := 0;
  v_item_total DECIMAL(15,2);
  v_new_start TIME;
  v_new_end TIME;
  v_inventory_ids BIGINT[] := ARRAY[]::BIGINT[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_usuarios WHERE id = p_usuario_id) THEN
    RAISE EXCEPTION 'El usuario no existe';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_usuario_roles
    WHERE usuario_id = p_usuario_id AND rol_id = p_rol_id
  ) THEN
    RAISE EXCEPTION 'El rol no está asignado al usuario';
  END IF;
  IF p_tipo_alquiler NOT IN ('por_hora', 'por_dia') THEN
    RAISE EXCEPTION 'Tipo de alquiler inválido';
  END IF;
  IF COALESCE(jsonb_typeof(p_items), '') <> 'array' THEN
    RAISE EXCEPTION 'Los recursos seleccionados no son válidos';
  END IF;

  SELECT * INTO v_config
  FROM komerizo_salon_config
  WHERE estado = 'activo'
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No existe configuración activa del salón'; END IF;

  IF p_tipo_alquiler = 'por_hora' THEN
    IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_inicio <> p_fecha_fin
       OR p_hora_inicio IS NULL OR p_hora_fin IS NULL OR p_hora_fin <= p_hora_inicio THEN
      RAISE EXCEPTION 'El horario por hora no es válido';
    END IF;
    IF p_hora_inicio < v_config.hora_apertura OR p_hora_fin > v_config.hora_cierre THEN
      RAISE EXCEPTION 'El horario está fuera del horario de atención del salón';
    END IF;
    v_duration_minutes := EXTRACT(EPOCH FROM (p_hora_fin - p_hora_inicio)) / 60;
    v_billable_hours := CEIL(v_duration_minutes / 60.0)::INT;
    v_total_salon := v_billable_hours * v_config.valor_por_hora;
    v_new_start := p_hora_inicio;
    v_new_end := p_hora_fin;
  ELSE
    IF p_fecha_inicio IS NULL OR p_fecha_fin IS NULL OR p_fecha_fin < p_fecha_inicio THEN
      RAISE EXCEPTION 'El rango de fechas no es válido';
    END IF;
    v_number_of_days := (p_fecha_fin - p_fecha_inicio) + 1;
    v_total_salon := v_number_of_days * v_config.valor_por_dia;
    v_new_start := v_config.hora_apertura;
    v_new_end := v_config.hora_cierre;
  END IF;

  PERFORM pg_advisory_xact_lock(42001001);

  IF EXISTS (
    SELECT 1
    FROM komerizo_alquileres a
    WHERE a.estado = 'confirmado'
      AND CASE
        WHEN p_tipo_alquiler = 'por_dia' THEN
          p_fecha_inicio <= COALESCE(a.fecha_fin, a.fecha_inicio)
          AND p_fecha_fin >= a.fecha_inicio
        WHEN a.tipo_alquiler = 'por_dia' THEN
          a.fecha_inicio <= p_fecha_inicio
          AND COALESCE(a.fecha_fin, a.fecha_inicio) >= p_fecha_inicio
        ELSE
          a.fecha_inicio = p_fecha_inicio
          AND p_hora_inicio < a.hora_fin
          AND p_hora_fin > a.hora_inicio
      END
  ) THEN
    RAISE EXCEPTION 'El salón no está disponible en el horario seleccionado';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    IF (v_item->>'inventario_id') IS NULL OR (v_item->>'cantidad') IS NULL THEN
      RAISE EXCEPTION 'Cada recurso debe incluir inventario_id y cantidad';
    END IF;
    IF (v_item->>'inventario_id')::BIGINT = ANY(v_inventory_ids) THEN
      RAISE EXCEPTION 'No se puede repetir un recurso seleccionado';
    END IF;
    v_inventory_ids := array_append(v_inventory_ids, (v_item->>'inventario_id')::BIGINT);
    v_qty := (v_item->>'cantidad')::INT;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'La cantidad solicitada debe ser mayor que cero';
    END IF;
    SELECT * INTO v_inventory
    FROM komerizo_inventario
    WHERE id = (v_item->>'inventario_id')::BIGINT
    FOR UPDATE;
    IF NOT FOUND OR NOT COALESCE(v_inventory.es_alquilable, false)
       OR v_inventory.estado <> 'activo' THEN
      RAISE EXCEPTION 'El recurso no está disponible para alquiler';
    END IF;

    SELECT COALESCE(SUM(i.cantidad_alquilada), 0) INTO v_reserved
    FROM komerizo_alquiler_recursos_items i
    JOIN komerizo_alquiler_recursos r ON r.id = i.alquiler_id
    WHERE i.inventario_id = v_inventory.id
      AND r.estado_alquiler IN ('pendiente', 'activo')
      AND r.fecha_inicio <= p_fecha_fin
      AND r.fecha_fin >= p_fecha_inicio;

    IF p_tipo_alquiler = 'por_dia' THEN
      SELECT v_reserved + COALESCE(SUM(i.cantidad_alquilada), 0) INTO v_reserved
      FROM komerizo_alquiler_items i
      JOIN komerizo_alquileres a ON a.id = i.alquiler_id
      WHERE i.inventario_id = v_inventory.id
        AND a.estado = 'confirmado'
        AND a.fecha_inicio <= p_fecha_fin
        AND COALESCE(a.fecha_fin, a.fecha_inicio) >= p_fecha_inicio;
    ELSE
      SELECT v_reserved + COALESCE(SUM(i.cantidad_alquilada), 0) INTO v_reserved
      FROM komerizo_alquiler_items i
      JOIN komerizo_alquileres a ON a.id = i.alquiler_id
      WHERE i.inventario_id = v_inventory.id
        AND a.estado = 'confirmado'
        AND (
          (a.tipo_alquiler = 'por_dia'
           AND a.fecha_inicio <= p_fecha_inicio
           AND COALESCE(a.fecha_fin, a.fecha_inicio) >= p_fecha_inicio)
          OR
          (a.tipo_alquiler = 'por_hora'
           AND a.fecha_inicio = p_fecha_inicio
           AND p_hora_inicio < a.hora_fin
           AND p_hora_fin > a.hora_inicio)
        );
    END IF;
    IF v_qty > v_inventory.cantidad - v_reserved THEN
      RAISE EXCEPTION 'Cantidad insuficiente del recurso seleccionado para ese horario';
    END IF;
    v_item_total := v_qty * COALESCE(v_inventory.valor_alquiler, 0);
    v_total_items := v_total_items + v_item_total;
  END LOOP;

  INSERT INTO komerizo_alquileres
    (usuario_id, rol_id, fecha_inicio, fecha_fin, hora_inicio, hora_fin,
     tipo_alquiler, cantidad, valor_total, motivo, estado, estado_pago)
  VALUES
    (p_usuario_id, p_rol_id, p_fecha_inicio, p_fecha_fin, v_new_start, v_new_end,
     p_tipo_alquiler,
     CASE WHEN p_tipo_alquiler = 'por_hora' THEN v_billable_hours ELSE v_number_of_days END,
     v_total_salon + v_total_items, p_motivo, 'confirmado', 'pendiente')
  RETURNING id INTO v_alquiler_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_inventory FROM komerizo_inventario WHERE id = (v_item->>'inventario_id')::BIGINT;
    v_qty := (v_item->>'cantidad')::INT;
    v_item_total := v_qty * COALESCE(v_inventory.valor_alquiler, 0);
    INSERT INTO komerizo_alquiler_items
      (alquiler_id, inventario_id, cantidad_alquilada, valor_unitario, valor_total)
    VALUES (v_alquiler_id, v_inventory.id, v_qty, v_inventory.valor_alquiler, v_item_total);
  END LOOP;
  RETURN v_alquiler_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_cerrar_alquiler_recursos(
  p_alquiler_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT,
  p_hubo_danos BOOLEAN, p_observacion TEXT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_rental komerizo_alquiler_recursos%ROWTYPE; v_mov BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;
  SELECT * INTO v_rental FROM komerizo_alquiler_recursos WHERE id = p_alquiler_id FOR UPDATE;
  IF NOT FOUND OR v_rental.estado_alquiler <> 'activo' THEN RAISE EXCEPTION 'El alquiler no está activo'; END IF;
  IF v_rental.deposito_garantia > 0 AND NOT p_hubo_danos THEN
    UPDATE komerizo_alquiler_recursos SET estado_deposito = 'devuelto' WHERE id = v_rental.id;
  ELSIF v_rental.deposito_garantia > 0 AND p_hubo_danos THEN
    v_mov := komerizo_registrar_ingreso_financiero(v_rental.deposito_garantia,
      'Aplicación de depósito de garantía por daños - alquiler de recursos #' || v_rental.id,
      'DEPOSITO-' || v_rental.id, v_rental.metodo_pago, 'alquiler_recursos_deposito', v_rental.id,
      p_tesorero_id, p_tesorero_rol_id);
    UPDATE komerizo_alquiler_recursos SET deposito_movimiento_id = v_mov, estado_deposito = 'aplicado_danos' WHERE id = v_rental.id;
  END IF;
  UPDATE komerizo_alquiler_recursos SET estado_alquiler = 'completado', observacion_cierre = p_observacion,
    fecha_cierre = NOW(), updated_at = NOW() WHERE id = v_rental.id;
END;
$$;

CREATE TABLE IF NOT EXISTS komerizo_ingresos_donaciones_cuotas (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('donacion','cuota')),
  usuario_asociado_id BIGINT REFERENCES komerizo_usuarios(id), numero_documento VARCHAR(50),
  nombre_persona VARCHAR(255) NOT NULL, celular VARCHAR(50), correo VARCHAR(255),
  monto DECIMAL(15,2) NOT NULL CHECK (monto > 0), justificacion TEXT NOT NULL,
  metodo_pago VARCHAR(50) NOT NULL, registrado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_registrador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  tesoreria_movimiento_id BIGINT UNIQUE REFERENCES komerizo_tesoreria(id), created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE komerizo_ingresos_donaciones_cuotas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS financial_donations_public_access ON komerizo_ingresos_donaciones_cuotas;
CREATE POLICY financial_donations_public_access ON komerizo_ingresos_donaciones_cuotas FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION komerizo_registrar_donacion_cuota(
  p_tipo VARCHAR, p_usuario_asociado_id BIGINT, p_numero_documento VARCHAR,
  p_nombre_persona VARCHAR, p_celular VARCHAR, p_correo VARCHAR, p_monto DECIMAL,
  p_justificacion TEXT, p_metodo_pago VARCHAR, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_source BIGINT; v_mov BIGINT; v_description TEXT; v_origin TEXT;
BEGIN
  IF p_tipo NOT IN ('donacion','cuota') THEN RAISE EXCEPTION 'Tipo de ingreso inválido'; END IF;
  IF COALESCE(BTRIM(p_nombre_persona), '') = '' OR p_monto IS NULL OR p_monto <= 0
     OR COALESCE(BTRIM(p_justificacion), '') = '' OR COALESCE(BTRIM(p_metodo_pago), '') = '' THEN
    RAISE EXCEPTION 'Nombre, monto, justificación y método de pago son obligatorios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;
  INSERT INTO komerizo_ingresos_donaciones_cuotas
    (tipo, usuario_asociado_id, numero_documento, nombre_persona, celular, correo, monto,
     justificacion, metodo_pago, registrado_por, rol_registrador_id)
  VALUES (p_tipo, p_usuario_asociado_id, p_numero_documento, p_nombre_persona, p_celular, p_correo,
          p_monto, p_justificacion, p_metodo_pago, p_tesorero_id, p_tesorero_rol_id)
  RETURNING id INTO v_source;
  v_description := CASE WHEN p_tipo = 'donacion' THEN 'Donación - ' ELSE 'Cuota de asociado - ' END || p_nombre_persona;
  v_origin := p_tipo;
  v_mov := komerizo_registrar_ingreso_financiero(p_monto, v_description,
    CASE WHEN p_tipo = 'donacion' THEN 'DONACION-' ELSE 'CUOTA-' END || v_source,
    p_metodo_pago, v_origin, v_source, p_tesorero_id, p_tesorero_rol_id);
  UPDATE komerizo_ingresos_donaciones_cuotas SET tesoreria_movimiento_id = v_mov WHERE id = v_source;
  RETURN v_source;
END;
$$;
