'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import { supabase } from '@/lib/supabase'
import './UsuarioSidebar.css'

export default function UsuarioSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [userRoles, setUserRoles] = useState<Array<{ id: number; nombre: string }>>(user?.roles || [])

  const menuItems = [
    { href: '/usuario', label: 'Mi Zona', icon: '🏠' },
    { href: '/usuario/informacion', label: 'Mi Información', icon: '📋' },
    { href: '/usuario/perfil', label: 'Mi Perfil', icon: '👤' },
    { href: '/usuario/afiliados', label: 'Afiliados', icon: '👥' },
    { href: '/usuario/solicitar-informe', label: 'Solicitar Informe', icon: '📤' },
    { href: '/usuario/eventos', label: 'Eventos', icon: '📅' },
    { href: '/usuario/salon', label: 'Alquilar Salón', icon: '🏛️' },
    { href: '/usuario/contactos', label: 'Contactos JAC', icon: '👥' },
  ]

  useEffect(() => {
    // Cargar los roles actualizados de la BD cuando se abre el dropdown
    if (showRoleDropdown && user?.id) {
      loadUserRoles()
    }
  }, [showRoleDropdown])

  const loadUserRoles = async () => {
    try {
      // Obtener roles del usuario desde BD
      const { data: usuarioRolesData } = await supabase
        .from('komerizo_usuario_roles')
        .select('rol_id')
        .eq('usuario_id', user.id)

      const roleIds = usuarioRolesData?.map((rel: any) => rel.rol_id) || []

      if (roleIds.length > 0) {
        const { data: rolesData } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .in('id', roleIds)
          .order('nombre', { ascending: true })

        if (rolesData) {
          setUserRoles(rolesData)
          // Actualizar en localStorage
          const updatedUser = { ...user, roles: rolesData }
          localStorage.setItem('komerizo_user', JSON.stringify(updatedUser))
        }
      }
    } catch (error) {
      console.error('Error al cargar roles:', error)
    }
  }

  const isActive = (href: string) => {
    if (href === '/usuario') {
      return pathname === '/usuario'
    }
    return pathname.startsWith(href)
  }

  const handleRoleChange = (roleNombre: string) => {
    console.log('🔄 [UsuarioSidebar] handleRoleChange:', roleNombre)
    const updatedUser = { ...user, activeRole: roleNombre }
    localStorage.setItem('komerizo_user', JSON.stringify(updatedUser))

    const redirectUrl = getRedirectUrlByRole([{ id: 0, nombre: roleNombre }])
    console.log('🔄 [UsuarioSidebar] Redirect URL:', redirectUrl)
    setShowRoleDropdown(false)

    if (redirectUrl) {
      console.log('🔄 [UsuarioSidebar] Navigating to:', redirectUrl)
      window.location.href = redirectUrl
    }
  }

  return (
    <aside className="usuario-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span>🏘️</span>
          <h2>Mi Zona</h2>
        </div>
        <p className="sidebar-subtitle">Portal Usuario</p>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link ${isActive(item.href) ? 'active' : ''}`}
          >
            <span className="link-icon">{item.icon}</span>
            <span className="link-text">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        {/* Selector de Roles */}
        {userRoles && userRoles.length > 1 && (
          <div className="role-selector">
            <div className="role-selector-label">Cambiar Rol</div>
            <div className="role-dropdown-container">
              <button
                className="role-dropdown-btn"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              >
                <span className="role-icon">👤</span>
                <span className="role-name">
                  {userRoles[0]?.nombre || 'Usuario'}
                </span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showRoleDropdown && (
                <div className="role-dropdown-menu">
                  {userRoles.map((role: any) => (
                    <button
                      key={role.id}
                      className="role-option"
                      onClick={() => handleRoleChange(role.nombre)}
                    >
                      <span className="role-option-name">{role.nombre}</span>
                      <span className="role-option-badge">●</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="user-info">
          <div className="user-avatar">
            {user?.nombre?.[0]?.toUpperCase()}
          </div>
          <div className="user-details">
            <p className="user-name">{user?.nombre} {user?.apellido}</p>
            <p className="user-role">Usuario</p>
          </div>
        </div>
        <button className="logout-btn" onClick={signOut}>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
