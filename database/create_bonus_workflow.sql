-- Ejecutar después de create_product_sales_workflow.sql.

CREATE TABLE IF NOT EXISTS komerizo_bonos_solidarios (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  cantidad_puestos INT NOT NULL CHECK (cantidad_puestos > 0),
  valor_puesto DECIMAL(15,2) NOT NULL CHECK (valor_puesto > 0),
  valor_premio DECIMAL(15,2) NOT NULL CHECK (valor_premio > 0),
  fecha_actividad DATE NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado','cancelado')),
  puesto_ganador INT,
  resultado_premio VARCHAR(30) CHECK (resultado_premio IS NULL OR resultado_premio IN ('entregado','no_entregado')),
  movimiento_premio_no_entregado_id BIGINT REFERENCES komerizo_tesoreria(id),
  creado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_creador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  cerrado_por BIGINT REFERENCES komerizo_usuarios(id),
  fecha_cierre TIMESTAMPTZ,
  resumen_cierre JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (puesto_ganador IS NULL OR puesto_ganador BETWEEN 1 AND cantidad_puestos)
);
CREATE INDEX IF NOT EXISTS idx_bonos_solidarios_estado ON komerizo_bonos_solidarios(estado);
CREATE INDEX IF NOT EXISTS idx_bonos_solidarios_fecha ON komerizo_bonos_solidarios(fecha_actividad);

CREATE TABLE IF NOT EXISTS komerizo_bono_compras (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  bono_id BIGINT NOT NULL REFERENCES komerizo_bonos_solidarios(id),
  comprador_usuario_id BIGINT REFERENCES komerizo_usuarios(id),
  numero_documento VARCHAR(50) NOT NULL,
  nombre_comprador VARCHAR(255) NOT NULL,
  celular VARCHAR(50),
  correo VARCHAR(255),
  puestos INT[] NOT NULL,
  cantidad_puestos INT NOT NULL CHECK (cantidad_puestos > 0),
  valor_unitario DECIMAL(15,2) NOT NULL CHECK (valor_unitario > 0),
  total DECIMAL(15,2) NOT NULL CHECK (total > 0),
  estado VARCHAR(20) NOT NULL CHECK (estado IN ('pagado','reservado','cancelado')),
  metodo_pago VARCHAR(50),
  tesoreria_movimiento_id BIGINT UNIQUE REFERENCES komerizo_tesoreria(id),
  creado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_creador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  fecha_registro TIMESTAMPTZ DEFAULT NOW(),
  fecha_pago TIMESTAMPTZ,
  fecha_cancelacion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bono_compras_bono ON komerizo_bono_compras(bono_id);
CREATE INDEX IF NOT EXISTS idx_bono_compras_documento ON komerizo_bono_compras(numero_documento);
CREATE INDEX IF NOT EXISTS idx_bono_compras_estado ON komerizo_bono_compras(estado);

CREATE TABLE IF NOT EXISTS komerizo_bono_puestos_ocupados (
  bono_id BIGINT NOT NULL REFERENCES komerizo_bonos_solidarios(id) ON DELETE CASCADE,
  numero_puesto INT NOT NULL,
  compra_id BIGINT NOT NULL REFERENCES komerizo_bono_compras(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (bono_id, numero_puesto)
);

ALTER TABLE komerizo_bonos_solidarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_bono_compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_bono_puestos_ocupados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bonos_solidarios_public_access ON komerizo_bonos_solidarios;
CREATE POLICY bonos_solidarios_public_access ON komerizo_bonos_solidarios FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS bono_compras_public_access ON komerizo_bono_compras;
CREATE POLICY bono_compras_public_access ON komerizo_bono_compras FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS bono_puestos_ocupados_public_access ON komerizo_bono_puestos_ocupados;
CREATE POLICY bono_puestos_ocupados_public_access ON komerizo_bono_puestos_ocupados FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION komerizo_crear_bono_solidario(
  p_nombre VARCHAR, p_descripcion TEXT, p_cantidad_puestos INT,
  p_valor_puesto DECIMAL, p_valor_premio DECIMAL, p_fecha_actividad DATE,
  p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_id BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;
  IF COALESCE(BTRIM(p_nombre), '') = '' THEN RAISE EXCEPTION 'El nombre es obligatorio'; END IF;
  IF p_cantidad_puestos IS NULL OR p_cantidad_puestos <= 0 THEN RAISE EXCEPTION 'La cantidad de puestos debe ser mayor que cero'; END IF;
  IF p_valor_puesto IS NULL OR p_valor_puesto <= 0 THEN RAISE EXCEPTION 'El valor del puesto debe ser mayor que cero'; END IF;
  IF p_valor_premio IS NULL OR p_valor_premio <= 0 THEN RAISE EXCEPTION 'El valor del premio debe ser mayor que cero'; END IF;
  IF p_fecha_actividad IS NULL THEN RAISE EXCEPTION 'La fecha de actividad es obligatoria'; END IF;
  INSERT INTO komerizo_bonos_solidarios(nombre, descripcion, cantidad_puestos, valor_puesto, valor_premio, fecha_actividad, creado_por, rol_creador_id)
  VALUES (BTRIM(p_nombre), p_descripcion, p_cantidad_puestos, p_valor_puesto, p_valor_premio, p_fecha_actividad, p_tesorero_id, p_tesorero_rol_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_registrar_compra_bono(
  p_bono_id BIGINT, p_comprador_usuario_id BIGINT, p_numero_documento VARCHAR,
  p_nombre_comprador VARCHAR, p_celular VARCHAR, p_correo VARCHAR, p_puestos INT[],
  p_estado_inicial VARCHAR, p_metodo_pago VARCHAR, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_bono komerizo_bonos_solidarios%ROWTYPE;
  v_user komerizo_usuarios%ROWTYPE;
  v_compra komerizo_bono_compras%ROWTYPE;
  v_position INT;
  v_documento VARCHAR(50); v_nombre VARCHAR(255); v_celular VARCHAR(50); v_correo VARCHAR(255);
  v_mov BIGINT; v_quantity INT; v_total DECIMAL(15,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero';
  END IF;
  SELECT * INTO v_bono FROM komerizo_bonos_solidarios WHERE id = p_bono_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El bono no existe'; END IF;
  IF v_bono.estado <> 'abierto' THEN RAISE EXCEPTION 'El bono no está abierto'; END IF;
  IF p_estado_inicial NOT IN ('pagado','reservado') THEN RAISE EXCEPTION 'El estado inicial no es válido'; END IF;
  IF p_puestos IS NULL OR cardinality(p_puestos) = 0 THEN RAISE EXCEPTION 'Debe seleccionar al menos un puesto'; END IF;
  IF cardinality(ARRAY(SELECT DISTINCT x FROM unnest(p_puestos) AS x)) <> cardinality(p_puestos) THEN RAISE EXCEPTION 'No se pueden repetir puestos'; END IF;
  FOREACH v_position IN ARRAY p_puestos LOOP
    IF v_position < 1 OR v_position > v_bono.cantidad_puestos THEN RAISE EXCEPTION 'El puesto seleccionado no es válido'; END IF;
    IF EXISTS (SELECT 1 FROM komerizo_bono_puestos_ocupados WHERE bono_id = v_bono.id AND numero_puesto = v_position) THEN
      RAISE EXCEPTION 'Uno o más puestos ya están ocupados';
    END IF;
  END LOOP;
  IF p_comprador_usuario_id IS NOT NULL THEN
    SELECT * INTO v_user FROM komerizo_usuarios WHERE id = p_comprador_usuario_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'El comprador afiliado no existe'; END IF;
    IF v_user.estado <> 'activo'
       OR NOT EXISTS (
         SELECT 1
         FROM komerizo_usuario_roles ur
         JOIN komerizo_roles r ON r.id = ur.rol_id
         WHERE ur.usuario_id = v_user.id
           AND r.nombre IN ('Usuario', 'Miembro')
       ) THEN
      RAISE EXCEPTION 'El comprador indicado no es un afiliado activo válido';
    END IF;
    v_documento := v_user.cc; v_nombre := BTRIM(COALESCE(v_user.nombre, '') || ' ' || COALESCE(v_user.apellido, ''));
    v_celular := v_user.telefono; v_correo := v_user.correo_electronico;
  ELSE
    v_documento := BTRIM(p_numero_documento); v_nombre := BTRIM(p_nombre_comprador); v_celular := p_celular; v_correo := p_correo;
    IF COALESCE(v_documento, '') = '' OR COALESCE(v_nombre, '') = '' THEN RAISE EXCEPTION 'Documento y nombre del comprador son obligatorios'; END IF;
  END IF;
  IF p_estado_inicial = 'pagado' AND COALESCE(BTRIM(p_metodo_pago), '') = '' THEN RAISE EXCEPTION 'El método de pago es obligatorio'; END IF;
  v_quantity := cardinality(p_puestos);
  v_total := v_quantity * v_bono.valor_puesto;
  INSERT INTO komerizo_bono_compras (bono_id, comprador_usuario_id, numero_documento, nombre_comprador, celular, correo, puestos, cantidad_puestos, valor_unitario, total, estado, metodo_pago, creado_por, rol_creador_id)
  VALUES (v_bono.id, p_comprador_usuario_id, v_documento, v_nombre, v_celular, v_correo, p_puestos, v_quantity, v_bono.valor_puesto, v_total, p_estado_inicial, CASE WHEN p_estado_inicial = 'pagado' THEN p_metodo_pago ELSE NULL END, p_tesorero_id, p_tesorero_rol_id)
  RETURNING * INTO v_compra;
  FOREACH v_position IN ARRAY p_puestos LOOP
    INSERT INTO komerizo_bono_puestos_ocupados(bono_id, numero_puesto, compra_id) VALUES (v_bono.id, v_position, v_compra.id);
  END LOOP;
  IF p_estado_inicial = 'pagado' THEN
    v_mov := komerizo_registrar_ingreso_financiero(v_compra.total, 'Bono solidario ' || v_bono.nombre || ' - Compra #' || v_compra.id, 'BONO-' || v_compra.id, p_metodo_pago, 'bono_solidario', v_compra.id, p_tesorero_id, p_tesorero_rol_id);
    UPDATE komerizo_bono_compras SET tesoreria_movimiento_id = v_mov, fecha_pago = NOW(), updated_at = NOW() WHERE id = v_compra.id;
  END IF;
  RETURN v_compra.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_pagar_reserva_bono(
  p_compra_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT, p_metodo_pago VARCHAR
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_compra komerizo_bono_compras%ROWTYPE; v_bono komerizo_bonos_solidarios%ROWTYPE; v_mov BIGINT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_compra FROM komerizo_bono_compras WHERE id = p_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La compra no existe'; END IF;
  SELECT * INTO v_bono FROM komerizo_bonos_solidarios WHERE id = v_compra.bono_id FOR UPDATE;
  IF v_compra.estado <> 'reservado' OR v_bono.estado <> 'abierto' THEN RAISE EXCEPTION 'La reserva no puede pagarse'; END IF;
  IF COALESCE(BTRIM(p_metodo_pago), '') = '' THEN RAISE EXCEPTION 'El método de pago es obligatorio'; END IF;
  v_mov := komerizo_registrar_ingreso_financiero(v_compra.total, 'Bono solidario ' || v_bono.nombre || ' - Compra #' || v_compra.id, 'BONO-' || v_compra.id, p_metodo_pago, 'bono_solidario', v_compra.id, p_tesorero_id, p_tesorero_rol_id);
  UPDATE komerizo_bono_compras SET estado = 'pagado', metodo_pago = p_metodo_pago, tesoreria_movimiento_id = v_mov, fecha_pago = NOW(), updated_at = NOW() WHERE id = v_compra.id;
  RETURN v_mov;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_cancelar_reserva_bono(
  p_compra_id BIGINT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_compra komerizo_bono_compras%ROWTYPE; v_bono komerizo_bonos_solidarios%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_compra FROM komerizo_bono_compras WHERE id = p_compra_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La compra no existe'; END IF;
  SELECT * INTO v_bono FROM komerizo_bonos_solidarios WHERE id = v_compra.bono_id FOR UPDATE;
  IF v_compra.estado <> 'reservado' OR v_bono.estado <> 'abierto' THEN RAISE EXCEPTION 'La reserva no puede cancelarse'; END IF;
  UPDATE komerizo_bono_compras SET estado = 'cancelado', fecha_cancelacion = NOW(), updated_at = NOW() WHERE id = v_compra.id;
  DELETE FROM komerizo_bono_puestos_ocupados WHERE compra_id = v_compra.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_cerrar_bono_solidario(
  p_bono_id BIGINT, p_puesto_ganador INT, p_tesorero_id BIGINT, p_tesorero_rol_id BIGINT, p_metodo_registro_premio VARCHAR
) RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
  v_bono komerizo_bonos_solidarios%ROWTYPE; v_winner_state VARCHAR; v_result VARCHAR; v_prize_movement BIGINT;
  v_summary JSONB; v_paid_positions BIGINT; v_reserved_positions BIGINT; v_paid_purchases BIGINT; v_reserved_purchases BIGINT; v_cancelled_purchases BIGINT; v_sales_income DECIMAL(15,2); v_prize_income DECIMAL(15,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  SELECT * INTO v_bono FROM komerizo_bonos_solidarios WHERE id = p_bono_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'El bono no existe'; END IF;
  IF v_bono.estado <> 'abierto' THEN RAISE EXCEPTION 'El bono no está abierto'; END IF;
  IF p_puesto_ganador IS NULL OR p_puesto_ganador < 1 OR p_puesto_ganador > v_bono.cantidad_puestos THEN RAISE EXCEPTION 'El puesto ganador no es válido'; END IF;
  SELECT bc.estado INTO v_winner_state FROM komerizo_bono_puestos_ocupados po JOIN komerizo_bono_compras bc ON bc.id = po.compra_id WHERE po.bono_id = v_bono.id AND po.numero_puesto = p_puesto_ganador;
  IF v_winner_state = 'pagado' THEN
    v_result := 'entregado'; v_prize_income := 0;
  ELSE
    v_result := 'no_entregado'; v_prize_income := v_bono.valor_premio;
    IF COALESCE(BTRIM(p_metodo_registro_premio), '') = '' THEN RAISE EXCEPTION 'El método de registro del premio es obligatorio'; END IF;
    v_prize_movement := komerizo_registrar_ingreso_financiero(v_bono.valor_premio, 'Premio no entregado - Bono solidario ' || v_bono.nombre, 'BONO-PREMIO-' || v_bono.id, p_metodo_registro_premio, 'bono_premio_no_entregado', v_bono.id, p_tesorero_id, p_tesorero_rol_id);
  END IF;
  SELECT COALESCE(SUM(cantidad_puestos) FILTER (WHERE estado = 'pagado'),0), COALESCE(SUM(cantidad_puestos) FILTER (WHERE estado = 'reservado'),0), COUNT(*) FILTER (WHERE estado = 'pagado'), COUNT(*) FILTER (WHERE estado = 'reservado'), COUNT(*) FILTER (WHERE estado = 'cancelado'), COALESCE(SUM(total) FILTER (WHERE estado = 'pagado'),0)
    INTO v_paid_positions, v_reserved_positions, v_paid_purchases, v_reserved_purchases, v_cancelled_purchases, v_sales_income FROM komerizo_bono_compras WHERE bono_id = v_bono.id;
  v_summary := jsonb_build_object('puestos_totales', v_bono.cantidad_puestos, 'puestos_pagados', v_paid_positions, 'puestos_reservados_no_pagados', v_reserved_positions, 'puestos_disponibles', v_bono.cantidad_puestos - v_paid_positions - v_reserved_positions, 'compras_pagadas', v_paid_purchases, 'compras_reservadas', v_reserved_purchases, 'compras_canceladas', v_cancelled_purchases, 'ingresos_ventas_pagadas', v_sales_income, 'puesto_ganador', p_puesto_ganador, 'resultado_premio', v_result, 'valor_premio', v_bono.valor_premio, 'ingreso_premio_no_entregado', v_prize_income, 'ingresos_totales_junta', v_sales_income + v_prize_income);
  UPDATE komerizo_bonos_solidarios SET estado = 'cerrado', puesto_ganador = p_puesto_ganador, resultado_premio = v_result, movimiento_premio_no_entregado_id = v_prize_movement, cerrado_por = p_tesorero_id, fecha_cierre = NOW(), resumen_cierre = v_summary, updated_at = NOW() WHERE id = v_bono.id;
  RETURN v_summary;
END;
$$;
