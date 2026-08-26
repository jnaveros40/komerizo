-- Crear tabla para solicitudes generales (cambio de comisión, desafiliación, etc)
CREATE TABLE IF NOT EXISTS komerizo_solicitudes_tramites (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE CASCADE,
  tipo_solicitud VARCHAR(100) NOT NULL, -- 'cambio_comision', 'desafiliacion', 'otro'
  detalles JSONB, -- { "nueva_comision_id": 2, "motivo": "..." }
  estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, en_revision, aprobado, rechazado
  respuesta TEXT,
  fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_respuesta TIMESTAMP WITH TIME ZONE,
  atendido_por BIGINT REFERENCES komerizo_usuarios(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_solicitudes_tramites_usuario ON komerizo_solicitudes_tramites(usuario_id);
CREATE INDEX idx_solicitudes_tramites_estado ON komerizo_solicitudes_tramites(estado);

ALTER TABLE komerizo_solicitudes_tramites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_solicitudes_tramites" ON komerizo_solicitudes_tramites
  FOR ALL
  USING (true);
