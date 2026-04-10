-- Crear tabla de informes completados
CREATE TABLE IF NOT EXISTS komerizo_informes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  solicitud_id BIGINT REFERENCES komerizo_solicitud_informes(id) ON DELETE CASCADE,
  rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  contenido TEXT NOT NULL,
  archivo_url VARCHAR(500),
  fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  estado VARCHAR(50) DEFAULT 'completado', -- borrador, completado, rechazado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_informes_solicitud_id ON komerizo_informes(solicitud_id);
CREATE INDEX IF NOT EXISTS idx_informes_rol_id ON komerizo_informes(rol_id);
CREATE INDEX IF NOT EXISTS idx_informes_usuario_id ON komerizo_informes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_informes_estado ON komerizo_informes(estado);

-- Habilitar RLS
ALTER TABLE komerizo_informes ENABLE ROW LEVEL SECURITY;
