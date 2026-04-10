-- Crear tabla de inventario actual
CREATE TABLE IF NOT EXISTS komerizo_inventario (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  cantidad NUMERIC(10, 2) NOT NULL DEFAULT 0,
  unidad VARCHAR(50), -- kg, litros, unidades, etc
  valor_unitario NUMERIC(10, 2) DEFAULT 0,
  valor_total NUMERIC(10, 2) GENERATED ALWAYS AS (cantidad * valor_unitario) STORED,
  categoria VARCHAR(100), -- Equipos, Materiales, Etc
  estado VARCHAR(50) DEFAULT 'activo', -- activo, inactivo, dañado
  fecha_ingreso TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de historial de cambios (INMUTABLE - solo INSERT)
CREATE TABLE IF NOT EXISTS komerizo_inventario_historial (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  inventario_id BIGINT NOT NULL REFERENCES komerizo_inventario(id) ON DELETE CASCADE,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE SET NULL,
  rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id) ON DELETE SET NULL,
  tipo_cambio VARCHAR(50) NOT NULL, -- creacion, modificacion, eliminacion
  
  -- Valores anteriores
  cantidad_anterior NUMERIC(10, 2),
  valor_unitario_anterior NUMERIC(10, 2),
  estado_anterior VARCHAR(50),
  
  -- Valores nuevos
  cantidad_nueva NUMERIC(10, 2),
  valor_unitario_nueva NUMERIC(10, 2),
  estado_nuevo VARCHAR(50),
  
  -- Metadata
  justificacion TEXT NOT NULL,
  observaciones TEXT,
  fecha_cambio TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de reportes programados
CREATE TABLE IF NOT EXISTS komerizo_inventario_reportes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tipo_reporte VARCHAR(50) NOT NULL, -- bimestral, cuatrimestral
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  generado_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE SET NULL,
  total_cambios INTEGER DEFAULT 0,
  valor_inicial NUMERIC(15, 2),
  valor_final NUMERIC(15, 2),
  detalles JSONB, -- Almacena cambios resumidos
  estado VARCHAR(50) DEFAULT 'generado', -- generado, validado, rechazado
  fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_inventario_categoria ON komerizo_inventario(categoria);
CREATE INDEX IF NOT EXISTS idx_inventario_estado ON komerizo_inventario(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_historial_inventario_id ON komerizo_inventario_historial(inventario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_historial_usuario_id ON komerizo_inventario_historial(usuario_id);
CREATE INDEX IF NOT EXISTS idx_inventario_historial_fecha ON komerizo_inventario_historial(fecha_cambio);
CREATE INDEX IF NOT EXISTS idx_inventario_reportes_tipo ON komerizo_inventario_reportes(tipo_reporte);
CREATE INDEX IF NOT EXISTS idx_inventario_reportes_fecha ON komerizo_inventario_reportes(fecha_inicio, fecha_fin);

-- Habilitar RLS
ALTER TABLE komerizo_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_inventario_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_inventario_reportes ENABLE ROW LEVEL SECURITY;
