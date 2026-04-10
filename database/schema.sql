-- Crear tabla de tipos de documentos
CREATE TABLE IF NOT EXISTS komerizo_tipo_documento (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre VARCHAR(50) NOT NULL UNIQUE,
  abreviatura VARCHAR(10) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de comunas
CREATE TABLE IF NOT EXISTS komerizo_comunas (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de barrios
CREATE TABLE IF NOT EXISTS komerizo_barrios (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre VARCHAR(100) NOT NULL,
  comuna_id BIGINT NOT NULL REFERENCES komerizo_comunas(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de roles
CREATE TABLE IF NOT EXISTS komerizo_roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de comisiones de trabajo
CREATE TABLE IF NOT EXISTS komerizo_comisiones (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  nombre VARCHAR(100) NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla principal de usuarios
CREATE TABLE IF NOT EXISTS komerizo_usuarios (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  cc VARCHAR(20) NOT NULL UNIQUE,
  tipo_documento_id BIGINT NOT NULL REFERENCES komerizo_tipo_documento(id),
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  telefono VARCHAR(20),
  direccion TEXT,
  comuna_id BIGINT REFERENCES komerizo_comunas(id),
  barrio_id BIGINT REFERENCES komerizo_barrios(id),
  jac VARCHAR(100),
  correo_electronico VARCHAR(255) UNIQUE NOT NULL,
  fecha_nacimiento DATE,
  comision_trabajo_id BIGINT REFERENCES komerizo_comisiones(id),
  fecha_inscripcion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  constancia_no_pertenecer_otra_jac BOOLEAN DEFAULT FALSE,
  estado VARCHAR(50) DEFAULT 'activo', -- activo, inactivo, suspendido
  novedades TEXT,
  observaciones TEXT,
  firma BOOLEAN DEFAULT FALSE,
  contrasena VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla de relación usuario-roles (uno a muchos)
CREATE TABLE IF NOT EXISTS komerizo_usuario_roles (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE CASCADE,
  rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(usuario_id, rol_id)
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_usuarios_cc ON komerizo_usuarios(cc);
CREATE INDEX IF NOT EXISTS idx_usuarios_correo ON komerizo_usuarios(correo_electronico);
CREATE INDEX IF NOT EXISTS idx_usuario_roles_usuario_id ON komerizo_usuario_roles(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_roles_rol_id ON komerizo_usuario_roles(rol_id);

-- Crear tabla de solicitudes de informes
CREATE TABLE IF NOT EXISTS komerizo_solicitud_informes (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  usuario_id BIGINT NOT NULL REFERENCES komerizo_usuarios(id) ON DELETE CASCADE,
  destinatario_rol_id BIGINT NOT NULL REFERENCES komerizo_roles(id) ON DELETE CASCADE,
  estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente', -- Pendiente, Respondido
  mensaje_solicitud TEXT NOT NULL,
  mensaje_respuesta TEXT,
  fecha_solicitud TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  fecha_respuesta TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para solicitud_informes
CREATE INDEX IF NOT EXISTS idx_solicitud_usuario_id ON komerizo_solicitud_informes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_destinatario_rol_id ON komerizo_solicitud_informes(destinatario_rol_id);
CREATE INDEX IF NOT EXISTS idx_solicitud_estado ON komerizo_solicitud_informes(estado);

-- Habilitar RLS (Row Level Security) si es necesario
ALTER TABLE komerizo_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_usuario_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE komerizo_solicitud_informes ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS básicas (opcional, ajusta según tus necesidades)
CREATE POLICY "public_read_usuarios" ON komerizo_usuarios
  FOR SELECT USING (true);

CREATE POLICY "user_update_own_profile" ON komerizo_usuarios
  FOR UPDATE USING (auth.uid()::text = id::text) WITH CHECK (auth.uid()::text = id::text);
