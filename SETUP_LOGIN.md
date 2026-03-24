# 📋 Configuración del Sistema de Login - Komerizo

## 1️⃣ Pasos de Implementación

### Paso 1: Ejecutar el SQL en Supabase

1. Abre tu proyecto en [Supabase](https://supabase.com)
2. Ve a **SQL Editor** en el menú lateral
3. Crea una nueva query y copia el contenido de [`database/schema.sql`](../database/schema.sql)
4. Ejecuta la query

Esto creará:
- ✅ Tablas de referencia (tipos de documentos, comunas, barrios, roles, comisiones)
- ✅ Tabla principal `komerizo_usuarios`
- ✅ Tabla de relación `komerizo_usuario_roles` (relación muchos-a-muchos para roles)
- ✅ Índices y políticas de seguridad

### Paso 2: Insertar Datos Iniciales

```sql
-- Insertar tipos de documentos
INSERT INTO komerizo_tipo_documento (nombre, abreviatura) VALUES
('Cédula de Ciudadanía', 'CC'),
('Cédula de Extranjería', 'CE'),
('Pasaporte', 'PA'),
('NIT', 'NIT');

-- Insertar comunas (ejemplo para Bogotá)
INSERT INTO komerizo_comunas (nombre) VALUES
('Usaquén'),
('Chapinero'),
('Santa Fe'),
('San Cristóbal'),
('Usme'),
('Tunjuelito'),
('Bosa'),
('Kennedy'),
('Fontibón'),
('Engativá'),
('Suba'),
('Barrios Unidos'),
('Teusaquillo'),
('Los Mártires'),
('Antonio Nariño'),
('Puente Aranda'),
('Candelaria'),
('Rafael Uribe Umaña'),
('Ciudad Bolívar'),
('Sumapaz');

-- Insertar barrios (ejemplo para la comuna 1)
INSERT INTO komerizo_barrios (nombre, comuna_id) VALUES
('Barrio Name', 1);

-- Insertar roles
INSERT INTO komerizo_roles (nombre, descripcion) VALUES
('Junta Directiva', 'Miembro de la junta directiva'),
('Tesorero', 'Responsable de finanzas'),
('Secretario', 'Responsable de actas'),
('Vocal', 'Vocal de la JAC'),
('Administrador', 'Administrador del sistema');

-- Insertar comisiones
INSERT INTO komerizo_comisiones (nombre, descripcion) VALUES
('Comisión de Seguridad', 'Seguridad del sector'),
('Comisión de Salud', 'Salud comunitaria'),
('Comisión de Educación', 'Educación y cultura'),
('Comisión de Infraestructura', 'Mejoras del sector');
```

### Paso 3: Crear un Usuario de Prueba

```sql
INSERT INTO komerizo_usuarios (
  cc,
  tipo_documento_id,
  nombre,
  apellido,
  correo_electronico,
  contrasena,
  telefono,
  estado
) VALUES (
  '1234567890',
  1,
  'Juan',
  'Pérez',
  'juan@example.com',
  'admin123', -- En producción usar bcrypt
  '3001234567',
  'activo'
);

-- Asignar un rol (primero obtén el usuario_id con una query)
INSERT INTO komerizo_usuario_roles (usuario_id, rol_id) VALUES
(1, 5); -- ID 5 es Administrador
```

## 2️⃣ Cambios Realizados en el Código

### AuthContext Actualizado
- En [src/contexts/AuthContext.tsx](../src/contexts/AuthContext.tsx)
- Ahora trabaja con la tabla `komerizo_usuarios` en lugar de Supabase Auth
- Guarda la sesión en `localStorage` bajo la clave `komerizo_user`
- Incluye información de roles

### Componente Login Actualizado
- En [src/components/Login.tsx](../src/components/Login.tsx)
- Permite iniciar sesión con **CC o Correo**
- Valida credenciales contra la tabla `komerizo_usuarios`
- Verifica el estado del usuario (activo/inactivo/suspendido)

### Librería de Autenticación
- En [src/lib/auth.ts](../src/lib/auth.ts)
- Incluye funciones para CRUD de usuarios
- Funciones para gestionar roles
- Funciones de validación (CC, correo únicos)

## 3️⃣ Seguridad - IMPORTANTE ⚠️

### En PRODUCCIÓN, debes:

1. **Encriptar contraseñas con BCrypt**
   ```bash
   npm install bcrypt
   ```
   
   ```typescript
   import bcrypt from 'bcrypt'
   
   // Al crear usuario
   const hashedPassword = await bcrypt.hash(password, 10)
   
   // Al verificar
   const isValid = await bcrypt.compare(password, hashedPassword)
   ```

2. **Usar variables de entorno para datos sensibles**
   - Asegurate que `.env.local` no esté en git

3. **Implementar HTTPS**

4. **Usar Supabase RLS (Row Level Security)** adecuadamente

5. **Auditoría de cambios** - considera agregar logs

## 4️⃣ Estructura de Datos

### Tabla: komerizo_usuarios
```
- id: bigint (PK, auto-increment)
- cc: varchar(20) UNIQUE
- tipo_documento_id: bigint (FK)
- nombre: varchar(100)
- apellido: varchar(100)
- telefono: varchar(20)
- direccion: text
- comuna_id: bigint (FK)
- barrio_id: bigint (FK)
- jac: varchar(100)
- correo_electronico: varchar(255) UNIQUE
- fecha_nacimiento: date
- comision_trabajo_id: bigint (FK)
- fecha_inscripcion: timestamp
- constancia_no_pertenecer_otra_jac: boolean
- estado: varchar(50) [activo, inactivo, suspendido]
- novedades: text
- observaciones: text
- firma: boolean
- contrasena: varchar(255)
```

### Tabla: komerizo_usuario_roles (relación muchos-a-muchos)
```
- id: bigint (PK)
- usuario_id: bigint (FK) → komerizo_usuarios
- rol_id: bigint (FK) → komerizo_roles
```

## 5️⃣ Uso en Componentes

```typescript
import { useAuth } from '@/contexts/AuthContext'

export function MiComponente() {
  const { user, loading, signOut } = useAuth()
  
  if (loading) return <p>Cargando...</p>
  if (!user) return <p>No autenticado</p>
  
  return (
    <div>
      <p>Bienvenido {user.nombre} {user.apellido}</p>
      <p>Correo: {user.correo_electronico}</p>
      <p>Roles: {user.roles?.map(r => r.nombre).join(', ')}</p>
      <button onClick={signOut}>Cerrar sesión</button>
    </div>
  )
}
```

## 6️⃣ Próximos Pasos Recomendados

- [ ] Panel de admin para gestionar usuarios
- [ ] Formulario para cambiar contraseña
- [ ] Recuperación de contraseña por correo
- [ ] Validación de correo por OTP
- [ ] Historial de login
- [ ] Panel de edición de perfil
- [ ] Permisiones basadas en roles (RBAC)
