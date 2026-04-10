-- Tabla para configuración de tarifas del salón comunal
CREATE TABLE IF NOT EXISTS komerizo_salon_config (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  valor_por_hora DECIMAL(10, 2) NOT NULL DEFAULT 0,
  valor_por_dia DECIMAL(10, 2) NOT NULL DEFAULT 0,
  hora_apertura TIME NOT NULL DEFAULT '08:00:00',
  hora_cierre TIME NOT NULL DEFAULT '22:00:00',
  descripcion TEXT,
  estado VARCHAR(20) DEFAULT 'activo',
  fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_por BIGINT REFERENCES komerizo_usuarios(id)
);

-- Tabla para reservas/alquileres del salón
CREATE TABLE IF NOT EXISTS komerizo_alquileres (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE,
  hora_inicio TIME,
  hora_fin TIME,
  tipo_alquiler VARCHAR(20) NOT NULL, -- 'por_hora' o 'por_dia'
  cantidad DECIMAL(10, 2) NOT NULL, -- cantidad de horas o días
  valor_total DECIMAL(10, 2) NOT NULL,
  motivo TEXT,
  estado VARCHAR(20) DEFAULT 'confirmado', -- confirmado, cancelado, completado
  observaciones TEXT,
  creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla para historial de cambios de tarifas
CREATE TABLE IF NOT EXISTS komerizo_salon_historial (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  valor_anterior JSONB,
  valor_nuevo JSONB,
  justificacion TEXT,
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejor rendimiento
CREATE INDEX idx_alquileres_usuario ON komerizo_alquileres(usuario_id);
CREATE INDEX idx_alquileres_fecha ON komerizo_alquileres(fecha_inicio, fecha_fin);
CREATE INDEX idx_alquileres_estado ON komerizo_alquileres(estado);
