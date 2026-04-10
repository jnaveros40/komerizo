'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import { supabase } from '@/lib/supabase'
import './JuntaDirectivaSidebar.css'

export default function JuntaDirectivaSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [userRoles, setUserRoles] = useState<Array<{ id: number; nombre: string }>>(user?.roles || [])

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/junta-directiva',
      icon: '📊',
    },
    {
      label: 'Solicitudes',
      href: '/junta-directiva/solicitudes',
      icon: '📋',
    },
    {
      label: 'Reuniones',
      href: '/junta-directiva/reuniones',
      icon: '📅',
    },
    {
      label: 'Miembros',
      href: '/junta-directiva/miembros',
      icon: '👥',
    },
    {
      label: 'Reportes',
      href: '/junta-directiva/reportes',
      icon: '📋',
    },
    {
      label: 'Decisiones',
      href: '/junta-directiva/decisiones',
      icon: '🗳️',
    },
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
      const { data: usuarioRolesData, error: usuarioRolesError } = await supabase
        .from('komerizo_usuario_roles')
        .select('rol_id')
        .eq('usuario_id', user.id)

      if (usuarioRolesError) throw usuarioRolesError

      if (usuarioRolesData && usuarioRolesData.length > 0) {
        const roleIds = usuarioRolesData.map((ur: any) => ur.rol_id)

        // Obtener detalles de los roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .in('id', roleIds)
          .order('nombre', { ascending: true })

        if (rolesError) throw rolesError

        if (rolesData) {
          setUserRoles(rolesData)
          // Guardar en localStorage también
          localStorage.setItem('userRoles', JSON.stringify(rolesData))
        }
      }
    } catch (error) {
      console.error('Error loading user roles:', error)
    }
  }

  const handleRoleChange = (roleName: string) => {
    const redirectUrl = getRedirectUrlByRole([{ id: 0, nombre: roleName }])
    router.push(redirectUrl)
    setShowRoleDropdown(false)
  }

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <aside className="junta-directiva-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">🏢</div>
        <span className="logo-text">Junta Directiva</span>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Spacer */}
      <div className="sidebar-spacer"></div>

      {/* Role Selector */}
      <div className="sidebar-section">
        <div className="section-label">Tus Roles</div>
        <button
          onClick={() => setShowRoleDropdown(!showRoleDropdown)}
          className="role-button"
        >
          <span>🔄</span>
          Cambiar Rol
        </button>

        {showRoleDropdown && (
          <div className="role-dropdown">
            {userRoles.length > 0 ? (
              userRoles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleChange(role.nombre)}
                  className="role-option"
                >
                  {role.nombre}
                </button>
              ))
            ) : (
              <div className="role-option-empty">Sin roles adicionales</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">
            <span>👤</span>
          </div>
          <div className="user-details">
            <p className="user-name">{user?.nombre || 'Usuario'}</p>
            <p className="user-email">{user?.email || ''}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>
    </aside>
  )
}
