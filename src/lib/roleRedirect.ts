/**
 * Obtiene la URL de redirección según el rol del usuario
 */
export function getRedirectUrlByRole(roles: Array<{ id: number; nombre: string }>): string {
  console.log('🔀 [roleRedirect] getRedirectUrlByRole called with roles:', roles)
  if (!roles || roles.length === 0) {
    console.log('🔀 [roleRedirect] No roles found, returning /usuario')
    return '/usuario'
  }

  // Definir prioridades de roles (el primero que encuentre, gana)
  const roleMap: Record<string, string> = {
    'Administrador': '/administrador',
    'Secretario': '/secretario',
    'Usuario': '/usuario',
    'Presidente': '/usuario',
    'Vicepresidente': '/usuario',
    'Tesorero': '/usuario',
    'Fiscal': '/usuario',
    'Junta Directiva': '/usuario',
    'Vocal': '/usuario',
    'Comisión de Convivencia y Conciliación': '/usuario',
    'Delegados a Asojuntas': '/usuario',
    'Coordinadores de Comisiones de Trabajo': '/usuario',
    'Coordinador Comisión Empresarial': '/usuario',
    'Miembro': '/usuario',
  }

  // Buscar el primer rol que tenga una redirección definida
  for (const role of roles) {
    if (roleMap[role.nombre]) {
      console.log(`🔀 [roleRedirect] Found role "${role.nombre}", redirecting to ${roleMap[role.nombre]}`)
      return roleMap[role.nombre]
    }
  }

  console.log('🔀 [roleRedirect] No matching role found, returning /usuario')
  return '/usuario'
}
