'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import './AdministradorSidebar.css'

export default function AdministradorSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const router = useRouter()
  const { signOut } = useAuth()
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)

  const menuItems = [
    { href: '/administrador', label: '📊 Dashboard', icon: '📊' },
    { href: '/administrador/usuarios', label: '👥 Usuarios', icon: '👥' },
    { href: '/administrador/comunas', label: '🏘️ Comunas y Barrios', icon: '🏘️' },
    { href: '/administrador/configuracion', label: '⚙️ Configuración', icon: '⚙️' },
  ]

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
        {user?.roles && user.roles.length > 1 && (
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
