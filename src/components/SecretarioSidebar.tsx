'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import './SecretarioSidebar.css'

export default function SecretarioSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/secretario',
      icon: '📊',
    },
    {
      label: 'Usuarios',
      href: '/secretario/usuarios',
      icon: '👥',
    },
    {
      label: 'Reportes',
      href: '/secretario/reportes',
      icon: '📈',
    },
    {
      label: 'Configuración',
      href: '/secretario/configuracion',
      icon: '⚙️',
    },
  ]

  const isActive = (href: string) => {
    if (href === '/secretario') {
      return pathname === href
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
    <aside className="secretario-sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <span className="logo-icon">🏛️</span>
          <span className="logo-text">Komerizo</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section">
          <p className="nav-section-title">MENÚ PRINCIPAL</p>
          <ul>
            {menuItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`nav-link ${isActive(item.href) ? 'active' : ''}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      <div className="sidebar-footer">
        {/* Selector de Roles */}
        {user?.roles && user.roles.length > 1 && (
          <div className="role-selector">
            <div className="role-selector-label">Rol Actual</div>
            <div className="role-dropdown-container">
              <button
                className="role-dropdown-btn"
                onClick={() => setShowRoleDropdown(!showRoleDropdown)}
              >
                <span className="role-icon">👤</span>
                <span className="role-name">Secretario</span>
                <span className="dropdown-arrow">▼</span>
              </button>
              {showRoleDropdown && (
                <div className="role-dropdown-menu">
                  {user.roles.map((role: any) => (
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
            {user?.nombre?.charAt(0).toUpperCase()}
          </div>
          <div className="user-details">
            <p className="user-name">
              {user?.nombre} {user?.apellido}
            </p>
            <p className="user-role">Secretario (Admin)</p>
          </div>
        </div>
        <button
          className="logout-btn"
          onClick={signOut}
          title="Cerrar sesión"
        >
          🚪
        </button>
      </div>
    </aside>
  )
}
