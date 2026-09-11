-- Parche idempotente para el flujo de egresos y auditoría financiera.

ALTER TABLE IF EXISTS komerizo_tesoreria
  DROP CONSTRAINT IF EXISTS komerizo_tesoreria_rol_id_fkey;

DO $$
BEGIN
  IF to_regclass('public.komerizo_tesoreria') IS NOT NULL
     AND to_regclass('public.komerizo_usuario_roles') IS NOT NULL THEN
    UPDATE komerizo_tesoreria t
    SET rol_id = ur.rol_id
    FROM komerizo_usuario_roles ur
    WHERE t.rol_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM komerizo_roles r WHERE r.id = t.rol_id)
      AND ur.id = t.rol_id;

    IF EXISTS (
      SELECT 1
      FROM komerizo_tesoreria t
      WHERE t.rol_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM komerizo_roles r WHERE r.id = t.rol_id)
    ) THEN
      RAISE EXCEPTION 'Existen movimientos de tesorería con rol_id inválido';
    END IF;
  END IF;
END $$;

ALTER TABLE IF EXISTS komerizo_tesoreria
  ALTER COLUMN referencia_externa TYPE VARCHAR(500);

DO $$
BEGIN
  IF to_regclass('public.komerizo_tesoreria') IS NOT NULL THEN
    ALTER TABLE komerizo_tesoreria
      ADD CONSTRAINT komerizo_tesoreria_rol_id_fkey
      FOREIGN KEY (rol_id) REFERENCES komerizo_roles(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE IF EXISTS komerizo_autorizaciones_gasto
  ADD COLUMN IF NOT EXISTS fecha_egreso DATE,
  ADD COLUMN IF NOT EXISTS concepto TEXT,
  ADD COLUMN IF NOT EXISTS beneficiario_destino VARCHAR(255),
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50),
  ADD COLUMN IF NOT EXISTS organo_responsable VARCHAR(50),
  ADD COLUMN IF NOT EXISTS numero_acta VARCHAR(100),
  ADD COLUMN IF NOT EXISTS motivo_devolucion TEXT,
  ADD COLUMN IF NOT EXISTS motivo_alerta TEXT,
  ADD COLUMN IF NOT EXISTS tesorero_id BIGINT REFERENCES komerizo_usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_envio_tesoreria TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_ultima_correccion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS movimiento_tesoreria_id BIGINT;

ALTER TABLE IF EXISTS komerizo_autorizaciones_gasto
  ALTER COLUMN justificacion DROP NOT NULL,
  ALTER COLUMN estado SET DEFAULT 'pendiente_tesoreria';

UPDATE komerizo_autorizaciones_gasto SET estado = 'pendiente_tesoreria' WHERE estado = 'pendiente';
UPDATE komerizo_autorizaciones_gasto SET estado = 'registrado' WHERE estado = 'aprobado';
UPDATE komerizo_autorizaciones_gasto SET estado = 'devuelto_presidente' WHERE estado = 'rechazado';

DO $$
BEGIN
  IF to_regclass('public.komerizo_autorizaciones_gasto') IS NOT NULL
     AND to_regclass('public.komerizo_tesoreria') IS NOT NULL THEN
    ALTER TABLE komerizo_autorizaciones_gasto
      ADD CONSTRAINT komerizo_autorizaciones_gasto_movimiento_tesoreria_id_fkey
      FOREIGN KEY (movimiento_tesoreria_id) REFERENCES komerizo_tesoreria(id);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS komerizo_autorizaciones_gasto_historial (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  autorizacion_id BIGINT NOT NULL REFERENCES komerizo_autorizaciones_gasto(id) ON DELETE CASCADE,
  actor_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  actor_rol_id BIGINT REFERENCES komerizo_roles(id),
  accion VARCHAR(80) NOT NULL,
  estado_anterior VARCHAR(50),
  estado_nuevo VARCHAR(50),
  comentario TEXT,
  snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_autorizaciones_gasto_historial_autorizacion
  ON komerizo_autorizaciones_gasto_historial(autorizacion_id);
CREATE INDEX IF NOT EXISTS idx_autorizaciones_gasto_historial_created_at
  ON komerizo_autorizaciones_gasto_historial(created_at);

CREATE TABLE IF NOT EXISTS komerizo_alertas_fiscales (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  autorizacion_gasto_id BIGINT REFERENCES komerizo_autorizaciones_gasto(id) ON DELETE CASCADE,
  movimiento_tesoreria_id BIGINT REFERENCES komerizo_tesoreria(id) ON DELETE CASCADE,
  origen VARCHAR(20) NOT NULL CHECK (origen IN ('tesorero', 'fiscal')),
  creada_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  motivo TEXT NOT NULL,
  estado VARCHAR(30) NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta', 'incluida_reporte', 'cerrada')),
  revisada_por BIGINT REFERENCES komerizo_usuarios(id),
  comentario_fiscal TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT alerta_fiscal_objetivo_no_nulo CHECK (
    autorizacion_gasto_id IS NOT NULL OR movimiento_tesoreria_id IS NOT NULL
  )
);
CREATE INDEX IF NOT EXISTS idx_alertas_fiscales_estado ON komerizo_alertas_fiscales(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_fiscales_autorizacion ON komerizo_alertas_fiscales(autorizacion_gasto_id);
CREATE INDEX IF NOT EXISTS idx_alertas_fiscales_movimiento ON komerizo_alertas_fiscales(movimiento_tesoreria_id);

ALTER TABLE IF EXISTS komerizo_tesoreria
  ADD COLUMN IF NOT EXISTS fecha_movimiento DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS autorizacion_gasto_id BIGINT REFERENCES komerizo_autorizaciones_gasto(id),
  ADD COLUMN IF NOT EXISTS beneficiario_destino VARCHAR(255),
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50),
  ADD COLUMN IF NOT EXISTS archivo_adjunto_url VARCHAR(500);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tesoreria_autorizacion_gasto
  ON komerizo_tesoreria(autorizacion_gasto_id) WHERE autorizacion_gasto_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS komerizo_solicitudes_configuracion_jac (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  secretario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  tope_gasto_presidente DECIMAL(15,2) NOT NULL,
  tope_gasto_junta DECIMAL(15,2) NOT NULL,
  motivo TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aplicada', 'rechazada')),
  administrador_id BIGINT REFERENCES komerizo_usuarios(id),
  comentario_administrador TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE IF EXISTS komerizo_configuracion_jac
  ADD COLUMN IF NOT EXISTS motivo_actualizacion TEXT;

ALTER TABLE IF EXISTS komerizo_solicitud_informes
  ADD COLUMN IF NOT EXISTS destinatario_id BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS movimiento_tesoreria_id BIGINT
    REFERENCES komerizo_tesoreria(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_solicitud_informes_movimiento_tesoreria_id
  ON komerizo_solicitud_informes(movimiento_tesoreria_id);

ALTER TABLE IF EXISTS komerizo_configuracion_jac ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS komerizo_autorizaciones_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS komerizo_autorizaciones_gasto_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS komerizo_alertas_fiscales ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS komerizo_solicitudes_configuracion_jac ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financial_config_public_access ON komerizo_configuracion_jac;
CREATE POLICY financial_config_public_access ON komerizo_configuracion_jac
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS financial_authorizations_public_access ON komerizo_autorizaciones_gasto;
CREATE POLICY financial_authorizations_public_access ON komerizo_autorizaciones_gasto
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS financial_authorization_history_public_access ON komerizo_autorizaciones_gasto_historial;
CREATE POLICY financial_authorization_history_public_access ON komerizo_autorizaciones_gasto_historial
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS financial_fiscal_alerts_public_access ON komerizo_alertas_fiscales;
CREATE POLICY financial_fiscal_alerts_public_access ON komerizo_alertas_fiscales
  FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS financial_config_requests_public_access ON komerizo_solicitudes_configuracion_jac;
CREATE POLICY financial_config_requests_public_access ON komerizo_solicitudes_configuracion_jac
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('komerizo-documentos', 'komerizo-documentos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS financial_documents_select ON storage.objects;
CREATE POLICY financial_documents_select ON storage.objects
  FOR SELECT USING (bucket_id = 'komerizo-documentos');
DROP POLICY IF EXISTS financial_documents_insert ON storage.objects;
CREATE POLICY financial_documents_insert ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'komerizo-documentos');
DROP POLICY IF EXISTS financial_documents_update ON storage.objects;
CREATE POLICY financial_documents_update ON storage.objects
  FOR UPDATE USING (bucket_id = 'komerizo-documentos') WITH CHECK (bucket_id = 'komerizo-documentos');

CREATE OR REPLACE FUNCTION komerizo_registrar_egreso_autorizado(
  p_autorizacion_id BIGINT,
  p_tesorero_id BIGINT,
  p_tesorero_rol_id BIGINT
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_autorizacion komerizo_autorizaciones_gasto%ROWTYPE;
  v_config komerizo_configuracion_jac%ROWTYPE;
  v_saldo komerizo_tesoreria_saldo%ROWTYPE;
  v_movimiento_id BIGINT;
  v_saldo_anterior DECIMAL(15,2);
  v_saldo_nuevo DECIMAL(15,2);
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

  SELECT * INTO v_autorizacion
  FROM komerizo_autorizaciones_gasto
  WHERE id = p_autorizacion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La autorización de gasto no existe';
  END IF;
  IF v_autorizacion.estado NOT IN ('pendiente_tesoreria', 'reenviado_tesoreria') THEN
    RAISE EXCEPTION 'La autorización no está pendiente de tesorería';
  END IF;
  IF v_autorizacion.monto_solicitado IS NULL OR v_autorizacion.monto_solicitado <= 0 THEN
    RAISE EXCEPTION 'El monto solicitado debe ser mayor que cero';
  END IF;
  IF v_autorizacion.fecha_egreso IS NULL THEN
    RAISE EXCEPTION 'La fecha del egreso es obligatoria';
  END IF;
  IF COALESCE(BTRIM(v_autorizacion.concepto), '') = '' THEN
    RAISE EXCEPTION 'El concepto es obligatorio';
  END IF;
  IF COALESCE(BTRIM(v_autorizacion.beneficiario_destino), '') = '' THEN
    RAISE EXCEPTION 'El beneficiario es obligatorio';
  END IF;
  IF COALESCE(BTRIM(v_autorizacion.metodo_pago), '') = '' THEN
    RAISE EXCEPTION 'El método de pago es obligatorio';
  END IF;
  IF COALESCE(BTRIM(v_autorizacion.archivo_adjunto_url), '') = ''
     AND COALESCE(BTRIM(v_autorizacion.justificacion), '') = '' THEN
    RAISE EXCEPTION 'Debe existir un documento de soporte o una justificación';
  END IF;

  SELECT * INTO v_config
  FROM komerizo_configuracion_jac
  ORDER BY id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe configuración financiera';
  END IF;

  IF v_autorizacion.monto_solicitado > v_config.tope_gasto_presidente THEN
    IF COALESCE(v_autorizacion.organo_responsable, '') NOT IN ('junta_directiva', 'asamblea_general')
       OR COALESCE(BTRIM(v_autorizacion.numero_acta), '') = ''
       OR COALESCE(BTRIM(v_autorizacion.archivo_adjunto_url), '') = '' THEN
      RAISE EXCEPTION 'Los egresos sobre el tope requieren órgano, acta y soporte';
    END IF;
  ELSIF COALESCE(v_autorizacion.organo_responsable, '') <> 'presidencia' THEN
    RAISE EXCEPTION 'El órgano responsable debe ser presidencia';
  END IF;

  SELECT * INTO v_saldo
  FROM komerizo_tesoreria_saldo
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO komerizo_tesoreria_saldo (saldo_actual, saldo_anterior, actualizado_por)
    VALUES (0, 0, p_tesorero_id)
    RETURNING * INTO v_saldo;
  END IF;

  v_saldo_anterior := v_saldo.saldo_actual;
  v_saldo_nuevo := v_saldo_anterior - v_autorizacion.monto_solicitado;
  IF v_saldo_nuevo < 0 THEN
    RAISE EXCEPTION 'Saldo insuficiente para registrar este egreso';
  END IF;

  INSERT INTO komerizo_tesoreria (
    tipo, cantidad, descripcion, saldo_anterior, saldo_nuevo, justificacion,
    referencia_externa, fecha_movimiento, beneficiario_destino, metodo_pago,
    archivo_adjunto_url, usuario_id, rol_id, estado, autorizacion_gasto_id
  ) VALUES (
    'gasto', v_autorizacion.monto_solicitado, v_autorizacion.concepto,
    v_saldo_anterior, v_saldo_nuevo, v_autorizacion.justificacion,
    v_autorizacion.numero_acta, v_autorizacion.fecha_egreso,
    v_autorizacion.beneficiario_destino, v_autorizacion.metodo_pago,
    v_autorizacion.archivo_adjunto_url, p_tesorero_id, p_tesorero_rol_id,
    'registrado', v_autorizacion.id
  ) RETURNING id INTO v_movimiento_id;

  UPDATE komerizo_tesoreria_saldo
  SET saldo_anterior = v_saldo_anterior,
      saldo_actual = v_saldo_nuevo,
      actualizado_por = p_tesorero_id,
      fecha_actualizacion = NOW()
  WHERE id = v_saldo.id;

  INSERT INTO komerizo_tesoreria_historial (
    movimiento_id, tipo_cambio, valor_anterior, valor_nuevo, razon, usuario_id
  ) VALUES (
    v_movimiento_id, 'registro_desde_autorizacion',
    jsonb_build_object('saldo_actual', v_saldo_anterior),
    jsonb_build_object('saldo_actual', v_saldo_nuevo),
    'Registro atómico de egreso autorizado', p_tesorero_id
  );

  UPDATE komerizo_autorizaciones_gasto
  SET estado = 'registrado', tesorero_id = p_tesorero_id,
      fecha_respuesta = NOW(), movimiento_tesoreria_id = v_movimiento_id,
      updated_at = NOW()
  WHERE id = v_autorizacion.id;

  INSERT INTO komerizo_autorizaciones_gasto_historial (
    autorizacion_id, actor_id, actor_rol_id, accion,
    estado_anterior, estado_nuevo, snapshot
  ) VALUES (
    v_autorizacion.id, p_tesorero_id, p_tesorero_rol_id,
    'registrado_tesoreria', v_autorizacion.estado, 'registrado',
    jsonb_build_object('movimiento_tesoreria_id', v_movimiento_id)
  );

  RETURN v_movimiento_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_aplicar_solicitud_configuracion(
  p_solicitud_id BIGINT,
  p_administrador_id BIGINT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_request komerizo_solicitudes_configuracion_jac%ROWTYPE;
  v_config komerizo_configuracion_jac%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_usuario_roles ur
    JOIN komerizo_roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = p_administrador_id
      AND r.nombre = 'Administrador'
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Administrador';
  END IF;

  SELECT * INTO v_request
  FROM komerizo_solicitudes_configuracion_jac
  WHERE id = p_solicitud_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud de configuración no existe'; END IF;
  IF v_request.estado <> 'pendiente' THEN RAISE EXCEPTION 'La solicitud de configuración ya fue resuelta'; END IF;
  IF v_request.tope_gasto_presidente <= 0 OR v_request.tope_gasto_junta <= 0 THEN
    RAISE EXCEPTION 'Las cuantías deben ser mayores que cero';
  END IF;
  IF v_request.tope_gasto_junta < v_request.tope_gasto_presidente THEN
    RAISE EXCEPTION 'La cuantía de Junta debe ser mayor o igual a la de Presidencia';
  END IF;

  SELECT * INTO v_config FROM komerizo_configuracion_jac ORDER BY id DESC LIMIT 1;
  IF FOUND THEN
    UPDATE komerizo_configuracion_jac
    SET tope_gasto_presidente = v_request.tope_gasto_presidente,
        tope_gasto_junta = v_request.tope_gasto_junta,
        motivo_actualizacion = v_request.motivo,
        actualizado_por = p_administrador_id,
        fecha_actualizacion = NOW()
    WHERE id = v_config.id;
  ELSE
    INSERT INTO komerizo_configuracion_jac
      (tope_gasto_presidente, tope_gasto_junta, motivo_actualizacion, actualizado_por, fecha_actualizacion)
    VALUES (v_request.tope_gasto_presidente, v_request.tope_gasto_junta,
            v_request.motivo, p_administrador_id, NOW());
  END IF;

  UPDATE komerizo_solicitudes_configuracion_jac
  SET estado = 'aplicada', administrador_id = p_administrador_id, resolved_at = NOW()
  WHERE id = v_request.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_fijar_cuantias_administrador(
  p_administrador_id BIGINT,
  p_tope_gasto_presidente DECIMAL,
  p_tope_gasto_junta DECIMAL,
  p_motivo TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
  v_config komerizo_configuracion_jac%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_usuario_roles ur
    JOIN komerizo_roles r ON r.id = ur.rol_id
    WHERE ur.usuario_id = p_administrador_id
      AND r.nombre = 'Administrador'
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Administrador';
  END IF;

  IF p_tope_gasto_presidente IS NULL OR p_tope_gasto_presidente <= 0 THEN
    RAISE EXCEPTION 'La cuantía del Presidente debe ser mayor que cero';
  END IF;
  IF p_tope_gasto_junta IS NULL OR p_tope_gasto_junta <= 0 THEN
    RAISE EXCEPTION 'La cuantía de la Junta debe ser mayor que cero';
  END IF;
  IF p_tope_gasto_junta < p_tope_gasto_presidente THEN
    RAISE EXCEPTION 'La cuantía de Junta debe ser mayor o igual a la de Presidencia';
  END IF;
  IF COALESCE(BTRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'El motivo de la actualización es obligatorio';
  END IF;

  -- Serializa los cambios directos y evita dos inserciones iniciales concurrentes.
  PERFORM pg_advisory_xact_lock(42001002);

  SELECT * INTO v_config
  FROM komerizo_configuracion_jac
  ORDER BY id DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE komerizo_configuracion_jac
    SET tope_gasto_presidente = p_tope_gasto_presidente,
        tope_gasto_junta = p_tope_gasto_junta,
        motivo_actualizacion = BTRIM(p_motivo),
        actualizado_por = p_administrador_id,
        fecha_actualizacion = NOW()
    WHERE id = v_config.id;
  ELSE
    INSERT INTO komerizo_configuracion_jac
      (tope_gasto_presidente, tope_gasto_junta, motivo_actualizacion, actualizado_por, fecha_actualizacion)
    VALUES (
      p_tope_gasto_presidente,
      p_tope_gasto_junta,
      BTRIM(p_motivo),
      p_administrador_id,
      NOW()
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_devolver_egreso_presidencia(
  p_autorizacion_id BIGINT,
  p_tesorero_id BIGINT,
  p_tesorero_rol_id BIGINT,
  p_motivo TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v_auth komerizo_autorizaciones_gasto%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id
  ) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  IF COALESCE(BTRIM(p_motivo), '') = '' THEN RAISE EXCEPTION 'El motivo es obligatorio'; END IF;
  SELECT * INTO v_auth FROM komerizo_autorizaciones_gasto WHERE id = p_autorizacion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La autorización de gasto no existe'; END IF;
  IF v_auth.estado NOT IN ('pendiente_tesoreria', 'reenviado_tesoreria') THEN
    RAISE EXCEPTION 'La autorización no está pendiente de tesorería';
  END IF;
  UPDATE komerizo_autorizaciones_gasto
  SET estado = 'devuelto_presidente', motivo_devolucion = p_motivo,
      tesorero_id = p_tesorero_id, fecha_respuesta = NOW(), updated_at = NOW()
  WHERE id = v_auth.id;
  INSERT INTO komerizo_autorizaciones_gasto_historial
    (autorizacion_id, actor_id, actor_rol_id, accion, estado_anterior, estado_nuevo, comentario)
  VALUES (v_auth.id, p_tesorero_id, p_tesorero_rol_id, 'devuelto_correccion',
          v_auth.estado, 'devuelto_presidente', p_motivo);
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_alertar_egreso_fiscal(
  p_autorizacion_id BIGINT,
  p_tesorero_id BIGINT,
  p_tesorero_rol_id BIGINT,
  p_motivo TEXT
) RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE v_auth komerizo_autorizaciones_gasto%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_roles r JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_tesorero_rol_id AND r.nombre = 'Tesorero' AND ur.usuario_id = p_tesorero_id
  ) THEN RAISE EXCEPTION 'El usuario indicado no tiene el rol Tesorero'; END IF;
  IF COALESCE(BTRIM(p_motivo), '') = '' THEN RAISE EXCEPTION 'El motivo es obligatorio'; END IF;
  SELECT * INTO v_auth FROM komerizo_autorizaciones_gasto WHERE id = p_autorizacion_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La autorización de gasto no existe'; END IF;
  IF v_auth.estado NOT IN ('pendiente_tesoreria', 'reenviado_tesoreria') THEN
    RAISE EXCEPTION 'La autorización no está pendiente de tesorería';
  END IF;
  UPDATE komerizo_autorizaciones_gasto
  SET estado = 'alertado_fiscal', motivo_alerta = p_motivo,
      tesorero_id = p_tesorero_id, fecha_respuesta = NOW(), updated_at = NOW()
  WHERE id = v_auth.id;
  INSERT INTO komerizo_alertas_fiscales
    (autorizacion_gasto_id, movimiento_tesoreria_id, origen, creada_por, motivo, estado)
  VALUES (v_auth.id, NULL, 'tesorero', p_tesorero_id, p_motivo, 'abierta');
  INSERT INTO komerizo_autorizaciones_gasto_historial
    (autorizacion_id, actor_id, actor_rol_id, accion, estado_anterior, estado_nuevo, comentario)
  VALUES (v_auth.id, p_tesorero_id, p_tesorero_rol_id, 'alertado_fiscal',
          v_auth.estado, 'alertado_fiscal', p_motivo);
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_crear_solicitud_egreso_presidencia(
  p_presidente_id BIGINT,
  p_presidente_rol_id BIGINT,
  p_fecha_egreso DATE,
  p_monto DECIMAL,
  p_concepto TEXT,
  p_beneficiario_destino VARCHAR,
  p_metodo_pago VARCHAR,
  p_justificacion TEXT,
  p_archivo_adjunto_url VARCHAR,
  p_organo_responsable VARCHAR,
  p_numero_acta VARCHAR
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_config komerizo_configuracion_jac%ROWTYPE;
  v_autorizacion komerizo_autorizaciones_gasto%ROWTYPE;
  v_organo VARCHAR(50);
  v_numero_acta VARCHAR(100);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_presidente_rol_id
      AND r.nombre = 'Presidente'
      AND ur.usuario_id = p_presidente_id
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Presidente';
  END IF;

  IF p_fecha_egreso IS NULL THEN
    RAISE EXCEPTION 'La fecha del egreso es obligatoria';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto solicitado debe ser mayor que cero';
  END IF;
  IF COALESCE(BTRIM(p_concepto), '') = '' THEN
    RAISE EXCEPTION 'El concepto es obligatorio';
  END IF;
  IF COALESCE(BTRIM(p_beneficiario_destino), '') = '' THEN
    RAISE EXCEPTION 'El beneficiario es obligatorio';
  END IF;
  IF COALESCE(BTRIM(p_metodo_pago), '') = '' THEN
    RAISE EXCEPTION 'El método de pago es obligatorio';
  END IF;
  IF COALESCE(BTRIM(p_archivo_adjunto_url), '') = ''
     AND COALESCE(BTRIM(p_justificacion), '') = '' THEN
    RAISE EXCEPTION 'Debe existir un documento de soporte o una justificación';
  END IF;

  SELECT * INTO v_config
  FROM komerizo_configuracion_jac
  ORDER BY id DESC
  LIMIT 1;
  IF NOT FOUND OR COALESCE(v_config.tope_gasto_presidente, 0) <= 0 THEN
    RAISE EXCEPTION 'No existe configuración financiera válida';
  END IF;

  IF p_monto <= v_config.tope_gasto_presidente THEN
    v_organo := 'presidencia';
    v_numero_acta := NULL;
  ELSE
    IF COALESCE(p_organo_responsable, '') NOT IN ('junta_directiva', 'asamblea_general')
       OR COALESCE(BTRIM(p_numero_acta), '') = ''
       OR COALESCE(BTRIM(p_archivo_adjunto_url), '') = '' THEN
      RAISE EXCEPTION 'Los egresos sobre el tope requieren órgano, acta y soporte';
    END IF;
    v_organo := p_organo_responsable;
    v_numero_acta := BTRIM(p_numero_acta);
  END IF;

  INSERT INTO komerizo_autorizaciones_gasto (
    solicitante_id,
    rol_solicitante_id,
    monto_solicitado,
    justificacion,
    archivo_adjunto_url,
    estado,
    fecha_egreso,
    concepto,
    beneficiario_destino,
    metodo_pago,
    organo_responsable,
    numero_acta,
    fecha_envio_tesoreria
  ) VALUES (
    p_presidente_id,
    p_presidente_rol_id,
    p_monto,
    NULLIF(BTRIM(p_justificacion), ''),
    NULLIF(BTRIM(p_archivo_adjunto_url), ''),
    'pendiente_tesoreria',
    p_fecha_egreso,
    BTRIM(p_concepto),
    BTRIM(p_beneficiario_destino),
    BTRIM(p_metodo_pago),
    v_organo,
    v_numero_acta,
    NOW()
  ) RETURNING * INTO v_autorizacion;

  INSERT INTO komerizo_autorizaciones_gasto_historial (
    autorizacion_id,
    actor_id,
    actor_rol_id,
    accion,
    estado_anterior,
    estado_nuevo,
    snapshot
  ) VALUES (
    v_autorizacion.id,
    p_presidente_id,
    p_presidente_rol_id,
    'creado',
    NULL,
    'pendiente_tesoreria',
    to_jsonb(v_autorizacion)
  );

  RETURN v_autorizacion.id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_corregir_solicitud_egreso_presidencia(
  p_autorizacion_id BIGINT,
  p_presidente_id BIGINT,
  p_presidente_rol_id BIGINT,
  p_fecha_egreso DATE,
  p_monto DECIMAL,
  p_concepto TEXT,
  p_beneficiario_destino VARCHAR,
  p_metodo_pago VARCHAR,
  p_justificacion TEXT,
  p_archivo_adjunto_url VARCHAR,
  p_organo_responsable VARCHAR,
  p_numero_acta VARCHAR,
  p_comentario TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_config komerizo_configuracion_jac%ROWTYPE;
  v_autorizacion komerizo_autorizaciones_gasto%ROWTYPE;
  v_organo VARCHAR(50);
  v_numero_acta VARCHAR(100);
  v_archivo_adjunto_url VARCHAR(500);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_presidente_rol_id
      AND r.nombre = 'Presidente'
      AND ur.usuario_id = p_presidente_id
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Presidente';
  END IF;

  SELECT * INTO v_autorizacion
  FROM komerizo_autorizaciones_gasto
  WHERE id = p_autorizacion_id
  FOR UPDATE;
  IF NOT FOUND
     OR v_autorizacion.solicitante_id <> p_presidente_id
     OR v_autorizacion.estado <> 'devuelto_presidente' THEN
    RAISE EXCEPTION 'El egreso no puede ser corregido en su estado actual';
  END IF;

  IF p_fecha_egreso IS NULL THEN
    RAISE EXCEPTION 'La fecha del egreso es obligatoria';
  END IF;
  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto solicitado debe ser mayor que cero';
  END IF;
  IF COALESCE(BTRIM(p_concepto), '') = '' THEN
    RAISE EXCEPTION 'El concepto es obligatorio';
  END IF;
  IF COALESCE(BTRIM(p_beneficiario_destino), '') = '' THEN
    RAISE EXCEPTION 'El beneficiario es obligatorio';
  END IF;
  IF COALESCE(BTRIM(p_metodo_pago), '') = '' THEN
    RAISE EXCEPTION 'El método de pago es obligatorio';
  END IF;

  v_archivo_adjunto_url := CASE
    WHEN COALESCE(BTRIM(p_archivo_adjunto_url), '') = '' THEN v_autorizacion.archivo_adjunto_url
    ELSE NULLIF(BTRIM(p_archivo_adjunto_url), '')
  END;
  IF COALESCE(BTRIM(v_archivo_adjunto_url), '') = ''
     AND COALESCE(BTRIM(p_justificacion), '') = '' THEN
    RAISE EXCEPTION 'Debe existir un documento de soporte o una justificación';
  END IF;

  SELECT * INTO v_config
  FROM komerizo_configuracion_jac
  ORDER BY id DESC
  LIMIT 1;
  IF NOT FOUND OR COALESCE(v_config.tope_gasto_presidente, 0) <= 0 THEN
    RAISE EXCEPTION 'No existe configuración financiera válida';
  END IF;

  IF p_monto <= v_config.tope_gasto_presidente THEN
    v_organo := 'presidencia';
    v_numero_acta := NULL;
  ELSE
    IF COALESCE(p_organo_responsable, '') NOT IN ('junta_directiva', 'asamblea_general')
       OR COALESCE(BTRIM(p_numero_acta), '') = ''
       OR COALESCE(BTRIM(v_archivo_adjunto_url), '') = '' THEN
      RAISE EXCEPTION 'Los egresos sobre el tope requieren órgano, acta y soporte';
    END IF;
    v_organo := p_organo_responsable;
    v_numero_acta := BTRIM(p_numero_acta);
  END IF;

  UPDATE komerizo_autorizaciones_gasto
  SET fecha_egreso = p_fecha_egreso,
      monto_solicitado = p_monto,
      concepto = BTRIM(p_concepto),
      beneficiario_destino = BTRIM(p_beneficiario_destino),
      metodo_pago = BTRIM(p_metodo_pago),
      justificacion = NULLIF(BTRIM(p_justificacion), ''),
      archivo_adjunto_url = v_archivo_adjunto_url,
      organo_responsable = v_organo,
      numero_acta = v_numero_acta,
      estado = 'reenviado_tesoreria',
      fecha_ultima_correccion = NOW(),
      fecha_envio_tesoreria = NOW(),
      motivo_devolucion = NULL,
      updated_at = NOW()
  WHERE id = v_autorizacion.id
  RETURNING * INTO v_autorizacion;

  INSERT INTO komerizo_autorizaciones_gasto_historial (
    autorizacion_id,
    actor_id,
    actor_rol_id,
    accion,
    estado_anterior,
    estado_nuevo,
    comentario,
    snapshot
  ) VALUES (
    v_autorizacion.id,
    p_presidente_id,
    p_presidente_rol_id,
    'corregido_reenviado',
    'devuelto_presidente',
    'reenviado_tesoreria',
    NULLIF(BTRIM(p_comentario), ''),
    to_jsonb(v_autorizacion)
  );
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_marcar_egreso_por_fiscal(
  p_movimiento_id BIGINT,
  p_fiscal_id BIGINT,
  p_fiscal_rol_id BIGINT,
  p_motivo TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_movimiento komerizo_tesoreria%ROWTYPE;
  v_autorizacion komerizo_autorizaciones_gasto%ROWTYPE;
  v_alerta_id BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_fiscal_rol_id
      AND r.nombre = 'Fiscal'
      AND ur.usuario_id = p_fiscal_id
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Fiscal';
  END IF;
  IF COALESCE(BTRIM(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'El motivo es obligatorio';
  END IF;

  SELECT * INTO v_movimiento
  FROM komerizo_tesoreria
  WHERE id = p_movimiento_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El movimiento de tesorería no existe';
  END IF;
  IF v_movimiento.tipo <> 'gasto' OR v_movimiento.estado <> 'registrado' THEN
    RAISE EXCEPTION 'El movimiento no es un gasto registrado';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM komerizo_alertas_fiscales
    WHERE movimiento_tesoreria_id = p_movimiento_id
      AND origen = 'fiscal'
      AND estado IN ('abierta', 'incluida_reporte')
  ) THEN
    RAISE EXCEPTION 'Este egreso ya tiene una alerta fiscal activa';
  END IF;

  INSERT INTO komerizo_alertas_fiscales (
    autorizacion_gasto_id,
    movimiento_tesoreria_id,
    origen,
    creada_por,
    motivo,
    estado,
    revisada_por,
    comentario_fiscal
  ) VALUES (
    v_movimiento.autorizacion_gasto_id,
    v_movimiento.id,
    'fiscal',
    p_fiscal_id,
    BTRIM(p_motivo),
    'incluida_reporte',
    p_fiscal_id,
    BTRIM(p_motivo)
  ) RETURNING id INTO v_alerta_id;

  IF v_movimiento.autorizacion_gasto_id IS NOT NULL THEN
    SELECT * INTO v_autorizacion
    FROM komerizo_autorizaciones_gasto
    WHERE id = v_movimiento.autorizacion_gasto_id
    FOR UPDATE;
    IF FOUND THEN
      INSERT INTO komerizo_autorizaciones_gasto_historial (
        autorizacion_id,
        accion,
        estado_anterior,
        estado_nuevo,
        comentario,
        actor_id,
        actor_rol_id
      ) VALUES (
        v_autorizacion.id,
        'marcado_por_fiscal',
        v_autorizacion.estado,
        v_autorizacion.estado,
        BTRIM(p_motivo),
        p_fiscal_id,
        p_fiscal_rol_id
      );
    END IF;
  END IF;

  RETURN v_alerta_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_incluir_alerta_reporte_fiscal(
  p_alerta_id BIGINT,
  p_fiscal_id BIGINT,
  p_fiscal_rol_id BIGINT,
  p_comentario TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_alerta komerizo_alertas_fiscales%ROWTYPE;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_roles r
    JOIN komerizo_usuario_roles ur ON ur.rol_id = r.id
    WHERE r.id = p_fiscal_rol_id
      AND r.nombre = 'Fiscal'
      AND ur.usuario_id = p_fiscal_id
  ) THEN
    RAISE EXCEPTION 'El usuario indicado no tiene el rol Fiscal';
  END IF;
  IF COALESCE(BTRIM(p_comentario), '') = '' THEN
    RAISE EXCEPTION 'El comentario es obligatorio';
  END IF;

  SELECT * INTO v_alerta
  FROM komerizo_alertas_fiscales
  WHERE id = p_alerta_id
  FOR UPDATE;
  IF NOT FOUND OR v_alerta.estado <> 'abierta' THEN
    RAISE EXCEPTION 'La alerta fiscal no está abierta';
  END IF;

  UPDATE komerizo_alertas_fiscales
  SET estado = 'incluida_reporte',
      revisada_por = p_fiscal_id,
      comentario_fiscal = BTRIM(p_comentario),
      updated_at = NOW()
  WHERE id = v_alerta.id;
END;
$$;
