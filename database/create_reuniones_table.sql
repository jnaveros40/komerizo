-- Crear tabla reuniones
CREATE TABLE komerizo_reuniones (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  creador_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE CASCADE,
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  tipo_reunion VARCHAR(50) NOT NULL,
  lugar VARCHAR(255),
  fecha_reunion DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  estado VARCHAR(50) DEFAULT 'pendiente',
  es_obligatoria BOOLEAN DEFAULT false,
  requiere_confirmacion BOOLEAN DEFAULT true,
  comuna_id BIGINT REFERENCES komerizo_comunas(id),
  barrio_id BIGINT REFERENCES komerizo_barrios(id),
  roles_invitados JSONB NOT NULL,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla para confirmaciones de asistencia
CREATE TABLE komerizo_reuniones_confirmaciones (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  reunion_id BIGINT NOT NULL REFERENCES komerizo_reuniones(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE CASCADE,
  estado_confirmacion VARCHAR(50) DEFAULT 'sin_responder',
  observaciones TEXT,
  fecha_confirmacion TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reunion_id, usuario_id)
);

-- Crear índices para mejorar performance
CREATE INDEX idx_reuniones_creador_id ON komerizo_reuniones(creador_id);
CREATE INDEX idx_reuniones_fecha_reunion ON komerizo_reuniones(fecha_reunion);
CREATE INDEX idx_reuniones_estado ON komerizo_reuniones(estado);
CREATE INDEX idx_reuniones_comuna_barrio ON komerizo_reuniones(comuna_id, barrio_id);
CREATE INDEX idx_confirmaciones_reunion_id ON komerizo_reuniones_confirmaciones(reunion_id);
CREATE INDEX idx_confirmaciones_usuario_id ON komerizo_reuniones_confirmaciones(usuario_id);

-- RLS Policies
ALTER TABLE komerizo_reuniones ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_reuniones_confirmaciones ENABLE ROW LEVEL SECURITY;

-- Política restrictiva: nadie ve nada por defecto en RLS
-- El control de acceso se maneja en la aplicación
CREATE POLICY "allow_all_reuniones" ON komerizo_reuniones
  FOR ALL
  USING (true);

CREATE POLICY "allow_all_confirmaciones" ON komerizo_reuniones_confirmaciones
  FOR ALL
  USING (true);
