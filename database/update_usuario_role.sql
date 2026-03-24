-- Actualizar el rol Usuario si existe, o insertar si no existe
INSERT INTO komerizo_roles (id, nombre, descripcion, created_at)
VALUES (13, 'Usuario', 'Usuario regular con acceso a su zona comunitaria', NOW())
ON CONFLICT (id) DO UPDATE SET
  descripcion = 'Usuario regular con acceso a su zona comunitaria';

-- Verificar que todos los roles están correctamente registrados
SELECT id, nombre, descripcion FROM komerizo_roles ORDER BY id;
