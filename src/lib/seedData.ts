/**
 * Script para insertar datos iniciales en Komerizo
 * Ejecutar desde la consola de Supabase o mediante una función
 */

import { supabase } from './supabase'

export async function insertarDatosIniciales() {
  try {
    console.log('Iniciando inserción de datos...')

    // 1. Insertar tipos de documentos
    const { data: tiposDoc, error: errorTiposDoc } = await supabase
      .from('komerizo_tipo_documento')
      .insert([
        { nombre: 'Cédula de Ciudadanía', abreviatura: 'CC' },
        { nombre: 'Cédula de Extranjería', abreviatura: 'CE' },
        { nombre: 'Pasaporte', abreviatura: 'PA' },
        { nombre: 'NIT', abreviatura: 'NIT' },
      ])
      .select()

    if (errorTiposDoc) throw errorTiposDoc
    console.log('✅ Tipos de documento insertados')

    // 2. Insertar roles
    const { data: roles, error: errorRoles } = await supabase
      .from('komerizo_roles')
      .insert([
        {
          nombre: 'Junta Directiva',
          descripcion: 'Miembro de la junta directiva',
        },
        { nombre: 'Tesorero', descripcion: 'Responsable de finanzas' },
        { nombre: 'Secretario', descripcion: 'Responsable de actas' },
        { nombre: 'Vocal', descripcion: 'Vocal de la JAC' },
        { nombre: 'Administrador', descripcion: 'Administrador del sistema' },
        { nombre: 'Miembro', descripcion: 'Miembro regular de la JAC' },
      ])
      .select()

    if (errorRoles) throw errorRoles
    console.log('✅ Roles insertados')

    // 3. Insertar comunas (ejemplo Bogotá)
    const comunas = [
      'Usaquén',
      'Chapinero',
      'Santa Fe',
      'San Cristóbal',
      'Usme',
      'Tunjuelito',
      'Bosa',
      'Kennedy',
      'Fontibón',
      'Engativá',
      'Suba',
      'Barrios Unidos',
      'Teusaquillo',
      'Los Mártires',
      'Antonio Nariño',
      'Puente Aranda',
      'Candelaria',
      'Rafael Uribe Umaña',
      'Ciudad Bolívar',
      'Sumapaz',
    ]

    const { data: comunasData, error: errorComunas } = await supabase
      .from('komerizo_comunas')
      .insert(comunas.map((nombre) => ({ nombre })))
      .select()

    if (errorComunas) throw errorComunas
    console.log('✅ Comunas insertadas')

    // 4. Insertar comisiones
    const { data: comisiones, error: errorComisiones } = await supabase
      .from('komerizo_comisiones')
      .insert([
        { nombre: 'Comisión de Seguridad', descripcion: 'Seguridad del sector' },
        { nombre: 'Comisión de Salud', descripcion: 'Salud comunitaria' },
        { nombre: 'Comisión de Educación', descripcion: 'Educación y cultura' },
        {
          nombre: 'Comisión de Infraestructura',
          descripcion: 'Mejoras del sector',
        },
      ])
      .select()

    if (errorComisiones) throw errorComisiones
    console.log('✅ Comisiones insertadas')

    console.log('✅ Datos iniciales insertados correctamente')
    return { success: true }
  } catch (error: any) {
    console.error('❌ Error al insertar datos:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Función para crear un usuario administrador
 */
export async function crearAdministrador(datos: {
  cc: string
  nombre: string
  apellido: string
  correo: string
  contrasena: string
}) {
  try {
    // Crear usuario
    const { data: usuario, error: errorUsuario } = await supabase
      .from('komerizo_usuarios')
      .insert([
        {
          cc: datos.cc,
          tipo_documento_id: 1, // CC
          nombre: datos.nombre,
          apellido: datos.apellido,
          correo_electronico: datos.correo,
          contrasena: datos.contrasena,
          estado: 'activo',
          firma: true,
        },
      ])
      .select()

    if (errorUsuario) throw errorUsuario
    if (!usuario || usuario.length === 0)
      throw new Error('Error al crear usuario')

    const usuarioId = usuario[0].id

    // Asignar rol de administrador
    const { error: errorRol } = await supabase
      .from('komerizo_usuario_roles')
      .insert([{ usuario_id: usuarioId, rol_id: 5 }]) // 5 es Administrador

    if (errorRol) throw errorRol

    console.log(`✅ Administrador creado: ${datos.nombre} ${datos.apellido}`)
    return { success: true, usuario }
  } catch (error: any) {
    console.error('❌ Error al crear administrador:', error)
    return { success: false, error: error.message }
  }
}
