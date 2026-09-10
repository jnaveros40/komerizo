-- Flujo compartido de solicitudes e informes.

ALTER TABLE komerizo_solicitud_informes
  ADD COLUMN IF NOT EXISTS titulo_respuesta VARCHAR(255),
  ADD COLUMN IF NOT EXISTS archivo_respuesta_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS movimiento_tesoreria_id BIGINT REFERENCES komerizo_tesoreria(id) ON DELETE SET NULL;

UPDATE komerizo_solicitud_informes
SET estado = 'Pendiente'
WHERE estado IS NULL;

ALTER TABLE komerizo_informes
  ADD COLUMN IF NOT EXISTS tipo_informe VARCHAR(50) NOT NULL DEFAULT 'gestion',
  ADD COLUMN IF NOT EXISTS es_publico BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_solicitud_informes_movimiento_tesoreria_id ON komerizo_solicitud_informes(movimiento_tesoreria_id);
CREATE INDEX IF NOT EXISTS idx_informes_tipo_informe ON komerizo_informes(tipo_informe);
CREATE INDEX IF NOT EXISTS idx_informes_es_publico ON komerizo_informes(es_publico);

ALTER TABLE komerizo_solicitud_informes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS informes_solicitudes_public_access ON komerizo_solicitud_informes;
CREATE POLICY informes_solicitudes_public_access ON komerizo_solicitud_informes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE komerizo_informes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS informes_public_access ON komerizo_informes;
CREATE POLICY informes_public_access ON komerizo_informes FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION komerizo_responder_solicitud_informe(
  p_solicitud_id BIGINT,
  p_usuario_responde_id BIGINT,
  p_rol_responde_id BIGINT,
  p_titulo VARCHAR,
  p_contenido TEXT,
  p_archivo_url VARCHAR
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_solicitud komerizo_solicitud_informes%ROWTYPE;
  v_informe_id BIGINT;
BEGIN
  IF COALESCE(BTRIM(p_titulo), '') = '' THEN
    RAISE EXCEPTION 'El título de la respuesta es obligatorio';
  END IF;
  IF COALESCE(BTRIM(p_contenido), '') = '' THEN
    RAISE EXCEPTION 'El contenido de la respuesta es obligatorio';
  END IF;

  SELECT * INTO v_solicitud
  FROM komerizo_solicitud_informes
  WHERE id = p_solicitud_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La solicitud de informe no existe'; END IF;
  IF COALESCE(v_solicitud.estado, '') <> 'Pendiente' THEN
    RAISE EXCEPTION 'La solicitud de informe ya fue respondida';
  END IF;
  IF v_solicitud.destinatario_rol_id <> p_rol_responde_id THEN
    RAISE EXCEPTION 'La solicitud no está dirigida al rol indicado';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM komerizo_usuario_roles ur
    WHERE ur.usuario_id = p_usuario_responde_id
      AND ur.rol_id = p_rol_responde_id
  ) THEN
    RAISE EXCEPTION 'El usuario no puede responder solicitudes dirigidas a este rol';
  END IF;
  IF EXISTS (SELECT 1 FROM komerizo_informes WHERE solicitud_id = v_solicitud.id) THEN
    RAISE EXCEPTION 'Esta solicitud ya tiene un informe asociado';
  END IF;

  UPDATE komerizo_solicitud_informes
  SET destinatario_id = p_usuario_responde_id,
      titulo_respuesta = BTRIM(p_titulo),
      mensaje_respuesta = BTRIM(p_contenido),
      archivo_respuesta_url = NULLIF(BTRIM(p_archivo_url), ''),
      fecha_respuesta = NOW(),
      estado = 'Respondido',
      updated_at = NOW()
  WHERE id = v_solicitud.id;

  INSERT INTO komerizo_informes (
    solicitud_id, rol_id, usuario_id, titulo, contenido, archivo_url,
    tipo_informe, es_publico, estado
  ) VALUES (
    v_solicitud.id, p_rol_responde_id, p_usuario_responde_id, p_titulo,
    p_contenido, p_archivo_url, 'respuesta_solicitud', FALSE, 'completado'
  ) RETURNING id INTO v_informe_id;

  RETURN v_informe_id;
END;
$$;

CREATE OR REPLACE FUNCTION komerizo_publicar_informe_gestion(
  p_usuario_id BIGINT,
  p_rol_id BIGINT,
  p_titulo VARCHAR,
  p_contenido TEXT,
  p_archivo_url VARCHAR,
  p_es_publico BOOLEAN DEFAULT TRUE
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE v_informe_id BIGINT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM komerizo_usuario_roles
    WHERE usuario_id = p_usuario_id AND rol_id = p_rol_id
  ) THEN
    RAISE EXCEPTION 'El usuario no tiene el rol indicado';
  END IF;
  IF COALESCE(BTRIM(p_titulo), '') = '' THEN RAISE EXCEPTION 'El título es obligatorio'; END IF;
  IF COALESCE(BTRIM(p_contenido), '') = '' THEN RAISE EXCEPTION 'El contenido es obligatorio'; END IF;

  INSERT INTO komerizo_informes (
    solicitud_id, rol_id, usuario_id, titulo, contenido, archivo_url,
    tipo_informe, es_publico, estado
  ) VALUES (
    NULL, p_rol_id, p_usuario_id, p_titulo, p_contenido, p_archivo_url,
    'gestion', COALESCE(p_es_publico, TRUE), 'completado'
  ) RETURNING id INTO v_informe_id;
  RETURN v_informe_id;
END;
$$;
