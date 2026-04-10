-- Tabla para registrar items del inventario alquilados junto con el salón
CREATE TABLE komerizo_alquiler_items (
  id BIGSERIAL PRIMARY KEY,
  alquiler_id BIGINT NOT NULL REFERENCES komerizo_alquileres(id) ON DELETE CASCADE,
  inventario_id BIGINT NOT NULL REFERENCES komerizo_inventario(id) ON DELETE RESTRICT,
  cantidad_alquilada INT NOT NULL,
  valor_unitario DECIMAL(12, 2) NOT NULL,
  valor_total DECIMAL(12, 2) NOT NULL,
  observaciones TEXT,
  creado_at TIMESTAMP DEFAULT NOW(),
  actualizado_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT cantidad_positiva CHECK (cantidad_alquilada > 0),
  CONSTRAINT valor_positivo CHECK (valor_total > 0)
);

-- Índices para búsquedas rápidas
CREATE INDEX idx_alquiler_items_alquiler_id ON komerizo_alquiler_items(alquiler_id);
CREATE INDEX idx_alquiler_items_inventario_id ON komerizo_alquiler_items(inventario_id);

-- Comentarios
COMMENT ON TABLE komerizo_alquiler_items IS 'Registra los items del inventario alquilados junto con el salón comunal';
COMMENT ON COLUMN komerizo_alquiler_items.cantidad_alquilada IS 'Cantidad de unidades del item alquiladas';
COMMENT ON COLUMN komerizo_alquiler_items.valor_unitario IS 'Precio de la unidad al momento del alquiler';
COMMENT ON COLUMN komerizo_alquiler_items.valor_total IS 'cantidad_alquilada * valor_unitario';
