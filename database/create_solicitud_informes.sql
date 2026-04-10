-- Crear tabla de solicitud de informes
CREATE TABLE IF NOT EXISTS komerizo_solicitud_informes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE CASCADE,
  destinatario_rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id) ON DELETE CASCADE,
  destinatario_id BIGINT DEFAULT 0, -- 0 si aún no ha sido asignado/respondido
  mensaje_solicitud TEXT NOT NULL,
  fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  mensaje_respuesta TEXT DEFAULT 'Pendiente de respuesta',
  fecha_respuesta TIMESTAMP WITH TIME ZONE,
  estado VARCHAR(50) DEFAULT 'Pendiente', -- Pendiente, Respondido
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_solicitud_informes_usuario_id ON komerizo_solicitud_informes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_informes_destinatario_rol_id ON komerizo_solicitud_informes(destinatario_rol_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_informes_destinatario_id ON komerizo_solicitud_informes(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_informes_estado ON komerizo_solicitud_informes(estado);

-- Habilitar RLS
ALTER TABLE komerizo_solicitud_informes ENABLE ROW LEVEL SECURITY;
