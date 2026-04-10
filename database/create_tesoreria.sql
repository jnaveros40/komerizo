-- Tabla de saldo actual de tesorería
CREATE TABLE komerizo_tesoreria_saldo (
  id BIGSERIAL PRIMARY KEY,
  saldo_actual DECIMAL(15, 2) DEFAULT 0,
  saldo_anterior DECIMAL(15, 2) DEFAULT 0,
  fecha_actualizacion TIMESTAMP DEFAULT NOW(),
  actualizado_por BIGINT REFERENCES komerizo_usuarios(id),
  CONSTRAINT saldo_no_negativo CHECK (saldo_actual >= 0)
);

-- Tabla de movimientos de tesorería
CREATE TABLE komerizo_tesoreria (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  cantidad DECIMAL(15, 2) NOT NULL,
  descripcion TEXT NOT NULL,
  saldo_anterior DECIMAL(15, 2) NOT NULL,
  saldo_nuevo DECIMAL(15, 2) NOT NULL,
  justificacion TEXT,
  referencia_externa VARCHAR(100),
  estado VARCHAR(20) DEFAULT 'registrado' CHECK (estado IN ('registrado', 'anulado', 'rectificado')),
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  rol_id BIGINT REFERENCES komerizo_usuario_roles(id),
  creado_at TIMESTAMP DEFAULT NOW(),
  actualizado_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT cantidad_positiva CHECK (cantidad > 0),
  CONSTRAINT saldos_validos CHECK (
    (tipo = 'ingreso' AND saldo_nuevo = saldo_anterior + cantidad) OR
    (tipo = 'gasto' AND saldo_nuevo = saldo_anterior - cantidad)
  )
);

-- Tabla de historial (auditoría de cambios)
CREATE TABLE komerizo_tesoreria_historial (
  id BIGSERIAL PRIMARY KEY,
  movimiento_id BIGINT NOT NULL REFERENCES komerizo_tesoreria(id) ON DELETE CASCADE,
  tipo_cambio VARCHAR(50),
  valor_anterior JSONB,
  valor_nuevo JSONB,
  razon TEXT,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id),
  fecha_cambio TIMESTAMP DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_tesoreria_tipo ON komerizo_tesoreria(tipo);
CREATE INDEX idx_tesoreria_usuario_id ON komerizo_tesoreria(usuario_id);
CREATE INDEX idx_tesoreria_creado_at ON komerizo_tesoreria(creado_at DESC);
CREATE INDEX idx_tesoreria_historial_movimiento_id ON komerizo_tesoreria_historial(movimiento_id);

-- Comentarios
COMMENT ON TABLE komerizo_tesoreria IS 'Registra todos los ingresos y gastos del fondo de tesorería con trazabilidad completa';
COMMENT ON TABLE komerizo_tesoreria_saldo IS 'Almacena el saldo actual y anterior para auditoría';
COMMENT ON TABLE komerizo_tesoreria_historial IS 'Auditoría de todos los cambios realizados en movimientos de tesorería';

COMMENT ON COLUMN komerizo_tesoreria.tipo IS 'Tipo de movimiento: ingreso o gasto';
COMMENT ON COLUMN komerizo_tesoreria.cantidad IS 'Monto del movimiento (siempre positivo)';
COMMENT ON COLUMN komerizo_tesoreria.saldo_anterior IS 'Saldo antes del movimiento';
COMMENT ON COLUMN komerizo_tesoreria.saldo_nuevo IS 'Saldo después del movimiento';
COMMENT ON COLUMN komerizo_tesoreria.justificacion IS 'Razón o justificación del movimiento';
COMMENT ON COLUMN komerizo_tesoreria.referencia_externa IS 'Número de recibo, factura, etc.';

-- Inicializar saldo en cero
INSERT INTO komerizo_tesoreria_saldo (saldo_actual, saldo_anterior, actualizado_por)
VALUES (0, 0, 1)
ON CONFLICT DO NOTHING;
