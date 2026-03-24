import { supabase } from './supabase'

/**
 * IMPORTANTE: Para PRODUCCIÓN, usar bcrypt en lugar de comparación directa
 * Este es un ejemplo básico. Instala: npm install bcrypt
 * Luego usa: import bcrypt from 'bcrypt'
 */

// Función para crear un usuario en komerizo_usuarios
export async function crearUsuario(usuarioData: {
  cc: string
  tipo_documento_id: number
  nombre: string
  apellido: string
  correo_electronico: string
  contrasena: string
  telefono?: string
  direccion?: string
  comuna_id?: number
  barrio_id?: number
  jac?: string
  fecha_nacimiento?: string
  comision_trabajo_id?: number
  constancia_no_pertenecer_otra_jac?: boolean
  observaciones?: string
  roles?: number[] // IDs de roles
}) {
  try {
    // Crear usuario
    const { data: usuario, error: errorUsuario } = await supabase
      .from('komerizo_usuarios')
      .insert([
        {
          cc: usuarioData.cc,
          tipo_documento_id: usuarioData.tipo_documento_id,
          nombre: usuarioData.nombre,
          apellido: usuarioData.apellido,
          correo_electronico: usuarioData.correo_electronico,
          contrasena: usuarioData.contrasena, // En producción, usar hash
          telefono: usuarioData.telefono,
          direccion: usuarioData.direccion,
          comuna_id: usuarioData.comuna_id,
          barrio_id: usuarioData.barrio_id,
          jac: usuarioData.jac,
          fecha_nacimiento: usuarioData.fecha_nacimiento,
          comision_trabajo_id: usuarioData.comision_trabajo_id,
          constancia_no_pertenecer_otra_jac:
            usuarioData.constancia_no_pertenecer_otra_jac,
          observaciones: usuarioData.observaciones,
          estado: 'activo',
        },
      ])
      .select()

    if (errorUsuario) throw errorUsuario
    if (!usuario || usuario.length === 0)
      throw new Error('Error al crear usuario')

    const usuarioId = usuario[0].id

    // Asignar roles si existen
    if (usuarioData.roles && usuarioData.roles.length > 0) {
      const rolesData = usuarioData.roles.map((rolId) => ({
        usuario_id: usuarioId,
        rol_id: rolId,
      }))

      const { error: errorRoles } = await supabase
        .from('komerizo_usuario_roles')
        .insert(rolesData)

      if (errorRoles) throw errorRoles
    }

    return { success: true, usuario }
  } catch (error: any) {
    console.error('Error creando usuario:', error)
    return { success: false, error: error.message }
  }
}

// Función para actualizar usuario
export async function actualizarUsuario(
  usuarioId: number,
  updateData: Partial<any>
) {
  try {
    const { data, error } = await supabase
      .from('komerizo_usuarios')
      .update(updateData)
      .eq('id', usuarioId)
      .select()

    if (error) throw error
    return { success: true, usuario: data?.[0] }
  } catch (error: any) {
    console.error('Error actualizando usuario:', error)
    return { success: false, error: error.message }
  }
}

// Función para obtener usuario con sus roles
export async function obtenerUsuarioConRoles(usuarioId: number) {
  try {
    const { data, error } = await supabase
      .from('komerizo_usuarios')
      .select('*, komerizo_usuario_roles(*, komerizo_roles(*))')
      .eq('id', usuarioId)
      .single()

    if (error) throw error
    return { success: true, usuario: data }
  } catch (error: any) {
    console.error('Error obteniendo usuario:', error)
    return { success: false, error: error.message }
  }
}

// Función para cambiar contraseña
export async function cambiarContrasena(
  usuarioId: number,
  contrasenaNueva: string
) {
  try {
    // En producción, usar hash
    const { data, error } = await supabase
      .from('komerizo_usuarios')
      .update({ contrasena: contrasenaNueva })
      .eq('id', usuarioId)
      .select()

    if (error) throw error
    return { success: true }
  } catch (error: any) {
    console.error('Error cambiando contraseña:', error)
    return { success: false, error: error.message }
  }
}

// Función para verificar si un CC ya existe
export async function verificarCCExistente(cc: string) {
  try {
    const { count, error } = await supabase
      .from('komerizo_usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('cc', cc)

    if (error) throw error
    return { existe: count ? count > 0 : false }
  } catch (error: any) {
    console.error('Error verificando CC:', error)
    return { existe: false, error: error.message }
  }
}

// Función para verificar si un correo ya existe
export async function verificarCorreoExistente(correo: string) {
  try {
    const { count, error } = await supabase
      .from('komerizo_usuarios')
      .select('*', { count: 'exact', head: true })
      .eq('correo_electronico', correo)

    if (error) throw error
    return { existe: count ? count > 0 : false }
  } catch (error: any) {
    console.error('Error verificando correo:', error)
    return { existe: false, error: error.message }
  }
}
