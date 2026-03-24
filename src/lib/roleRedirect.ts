/**
 * Obtiene la URL de redirección según el rol del usuario
 */
export function getRedirectUrlByRole(roles: Array<{ id: number; nombre: string }>): string {
  if (!roles || roles.length === 0) {
    return '/'
  }

  // Definir prioridades de roles (el primero que encuentre, gana)
  const roleMap: Record<string, string> = {
    'Administrador': '/administrador',
    'Secretario': '/secretario',
    'Junta Directiva': '/junta-directiva',
    'Tesorero': '/tesorero',
    'Vocal': '/vocal',
    'Coordinador': '/coordinador',
    'Miembro': '/',
  }

  // Buscar el primer rol que tenga una redirección definida
  for (const role of roles) {
    if (roleMap[role.nombre]) {
      return roleMap[role.nombre]
    }
  }

  return '/'
}
