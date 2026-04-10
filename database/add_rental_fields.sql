-- Agregar campos de alquiler a la tabla komerizo_inventario
ALTER TABLE komerizo_inventario
ADD COLUMN es_alquilable BOOLEAN DEFAULT FALSE,
ADD COLUMN valor_alquiler DECIMAL(10, 2) DEFAULT 0;
