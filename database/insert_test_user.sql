-- ============================================
-- SQL para insertar USUARIO DE PRUEBA
-- CC: 111111
-- Contraseña: prueba
-- ============================================

-- PASO 1: Insertar tipos de documento
INSERT INTO komerizo_tipo_documento (nombre, abreviatura) 
VALUES 
  ('Cédula de Ciudadanía', 'CC'),
  ('Cédula de Extranjería', 'CE'),
  ('Pasaporte', 'PA'),
  ('NIT', 'NIT')
ON CONFLICT (abreviatura) DO NOTHING;

-- PASO 2: Insertar usuario de prueba
INSERT INTO komerizo_usuarios (
  cc,
  tipo_documento_id,
  nombre,
  apellido,
  correo_electronico,
  contrasena,
  telefono,
  direccion,
  jac,
  estado,
  firma
) VALUES (
  '111111',
  1,
  'Juan',
  'Prueba',
  'juan.prueba@test.com',
  'prueba',
  '3001234567',
  'Calle 123 #45-67',
  'JAC Barrio Test',
  'activo',
  true
);

-- PASO 3: Insertar roles (si no existen)
INSERT INTO komerizo_roles (nombre, descripcion)
VALUES
  ('Junta Directiva', 'Miembro de la junta directiva'),
  ('Tesorero', 'Responsable de finanzas'),
  ('Secretario', 'Responsable de actas'),
  ('Vocal', 'Vocal de la JAC'),
  ('Administrador', 'Administrador del sistema'),
  ('Miembro', 'Miembro regular de la JAC')
ON CONFLICT (nombre) DO NOTHING;

-- PASO 4: Asignar rol de Miembro al usuario de prueba
INSERT INTO komerizo_usuario_roles (usuario_id, rol_id)
SELECT 
  (SELECT id FROM komerizo_usuarios WHERE cc = '111111'),
  (SELECT id FROM komerizo_roles WHERE nombre = 'Miembro')
WHERE NOT EXISTS (
  SELECT 1 FROM komerizo_usuario_roles 
  WHERE usuario_id = (SELECT id FROM komerizo_usuarios WHERE cc = '111111')
);

-- ============================================
-- Verificar que el usuario fue creado correctamente
-- ============================================
-- SELECT * FROM komerizo_usuarios WHERE cc = '111111';
-- SELECT * FROM komerizo_usuario_roles WHERE usuario_id = (SELECT id FROM komerizo_usuarios WHERE cc = '111111');
