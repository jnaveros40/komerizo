-- ==============================================================================
-- 1. CONFIGURACIÓN GENERAL DE LA JAC (Topes de gastos y Quórum)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS komerizo_configuracion_jac (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  tope_gasto_presidente DECIMAL(15, 2) NOT NULL DEFAULT 0,
  tope_gasto_junta DECIMAL(15, 2) NOT NULL DEFAULT 0,
  quorum_minimo_asamblea INT DEFAULT 50,
  quorum_minimo_junta INT DEFAULT 7,
  actualizado_por BIGINT REFERENCES komerizo_usuarios(id) ON DELETE SET NULL,
  fecha_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar configuración inicial por defecto
INSERT INTO komerizo_configuracion_jac (tope_gasto_presidente, tope_gasto_junta, quorum_minimo_asamblea)
VALUES (1000000, 3000000, 50)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 2. ACTAS (Asambleas, Directiva, Comisiones)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS komerizo_actas (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  creador_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE RESTRICT,
  rol_creador_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  tipo_acta VARCHAR(100) NOT NULL, -- 'Asamblea General', 'Junta Directiva', 'Comisión de Trabajo', 'Comisión Empresarial'
  fecha_acta DATE NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  contenido TEXT,
  archivo_url VARCHAR(500), -- Enlace al PDF del acta escaneada/firmada
  estado VARCHAR(50) DEFAULT 'publicada', -- borrador, publicada
  comision_id BIGINT REFERENCES komerizo_comisiones(id) ON DELETE CASCADE, -- Si es acta de comisión
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_actas_tipo ON komerizo_actas(tipo_acta);
CREATE INDEX idx_actas_fecha ON komerizo_actas(fecha_acta);

-- ==============================================================================
-- 3. DOCUMENTOS OFICIALES (Reglamentos y Estatutos)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS komerizo_documentos_oficiales (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  subido_por BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  tipo_documento VARCHAR(100) NOT NULL, -- 'Estatuto', 'Reglamento Junta', 'Reglamento Comisión Empresarial', 'Reglamento Comisión de Trabajo'
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT,
  archivo_url VARCHAR(500) NOT NULL,
  estado_vigencia VARCHAR(50) DEFAULT 'vigente', -- vigente, derogado
  estado_aprobacion VARCHAR(50) DEFAULT 'aprobado', -- pendiente, aprobado, rechazado (útil para reglamentos de comisiones que aprueba la junta)
  comision_id BIGINT REFERENCES komerizo_comisiones(id) ON DELETE CASCADE,
  fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_documentos_tipo ON komerizo_documentos_oficiales(tipo_documento);

-- ==============================================================================
-- 4. AUTORIZACIONES DE GASTO (Para superar topes de cuantía)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS komerizo_autorizaciones_gasto (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  solicitante_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_solicitante_id BIGINT NOT NULL REFERENCES komerizo_roles(id),
  monto_solicitado DECIMAL(15, 2) NOT NULL,
  justificacion TEXT NOT NULL,
  archivo_adjunto_url VARCHAR(500), -- Cotizaciones, etc.
  estado VARCHAR(50) DEFAULT 'pendiente', -- pendiente, aprobado, rechazado
  aprobado_por BIGINT REFERENCES komerizo_usuarios(id), -- Usuario (Asamblea/Junta) que aprobó
  acta_aprobacion_id BIGINT REFERENCES komerizo_actas(id), -- Acta donde consta la aprobación
  fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_respuesta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX idx_autorizaciones_estado ON komerizo_autorizaciones_gasto(estado);

-- ==============================================================================
-- 5. PROGRAMAS Y ACTIVIDADES (Subidos por Secretaría u otros)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS komerizo_programas_actividades (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  creador_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  titulo VARCHAR(255) NOT NULL,
  descripcion TEXT NOT NULL,
  fecha_inicio DATE,
  fecha_fin DATE,
  archivo_url VARCHAR(500),
  estado VARCHAR(50) DEFAULT 'activo', -- activo, finalizado, cancelado
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- 6. TIENDA / BAZAR (Productos y Ventas para Tesorería)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS komerizo_tienda_productos (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  precio_costo DECIMAL(12, 2) NOT NULL DEFAULT 0,
  precio_venta DECIMAL(12, 2) NOT NULL DEFAULT 0,
  stock INT NOT NULL DEFAULT 0,
  estado VARCHAR(50) DEFAULT 'activo', -- activo, inactivo
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS komerizo_tienda_ventas (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  vendedor_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id), -- Normalmente el Tesorero
  comprador_id BIGINT REFERENCES komerizo_usuarios(id), -- Puede ser NULL si es venta a un tercero externo
  nombre_comprador_externo VARCHAR(255),
  total_venta DECIMAL(15, 2) NOT NULL,
  total_costo DECIMAL(15, 2) NOT NULL,
  utilidad DECIMAL(15, 2) GENERATED ALWAYS AS (total_venta - total_costo) STORED,
  estado_pago VARCHAR(50) DEFAULT 'pagado', -- pagado, fiado, anulado
  metodo_pago VARCHAR(50), -- efectivo, transferencia
  fecha_venta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS komerizo_tienda_venta_detalles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  venta_id BIGINT NOT NULL REFERENCES komerizo_tienda_ventas(id) ON DELETE CASCADE,
  producto_id BIGINT NOT NULL REFERENCES komerizo_tienda_productos(id),
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(12, 2) NOT NULL,
  subtotal DECIMAL(15, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);
CREATE INDEX idx_ventas_estado_pago ON komerizo_tienda_ventas(estado_pago);

-- Habilitar RLS en las nuevas tablas
ALTER TABLE komerizo_configuracion_jac ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_actas ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_documentos_oficiales ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_autorizaciones_gasto ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_programas_actividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_tienda_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_tienda_ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_tienda_venta_detalles ENABLE ROW LEVEL SECURITY;
