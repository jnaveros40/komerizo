'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import { supabase } from '@/lib/supabase'
import './AdministradorSidebar.css'

export default function AdministradorSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [userRoles, setUserRoles] = useState<Array<{ id: number; nombre: string }>>(user?.roles || [])

  const menuItems = [
    { href: '/administrador', label: '📊 Dashboard', icon: '📊' },
    { href: '/administrador/solicitudes', label: '📋 Solicitudes', icon: '📋' },
    { href: '/administrador/usuarios', label: '👥 Usuarios', icon: '👥' },
    { href: '/administrador/comunas', label: '🏘️ Comunas y Barrios', icon: '🏘️' },
    { href: '/administrador/configuracion', label: '⚙️ Configuración', icon: '⚙️' },
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
    if (href === '/administrador') {
      return pathname === '/administrador'
    }
    return pathname.startsWith(href)
  }

  const handleRoleChange = (roleNombre: string) => {
    // Guardar el rol seleccionado en localStorage
    const updatedUser = { ...user, activeRole: roleNombre }
    localStorage.setItem('komerizo_user', JSON.stringify(updatedUser))

    // Redirigir al dashboard del nuevo rol
    const redirectUrl = getRedirectUrlByRole([{ id: 0, nombre: roleNombre }])
    setShowRoleDropdown(false)
    
    if (redirectUrl) {
      window.location.href = redirectUrl
    }
  }

  return (
    <aside className="administrador-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span>🔐</span>
          <h2>Admin</h2>
        </div>
        <p className="sidebar-subtitle">Panel de Control</p>
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
            <div className="role-selector-label">Rol Actual</div>
            <div className="role-dropdown-container">
              <button
                className="role-dropdown-btn"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              >
                <span className="role-icon">👤</span>
                <span className="role-name">Administrador</span>
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
            <p className="user-role">Administrador</p>
          </div>
        </div>
        <button className="logout-btn" onClick={signOut}>
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
