'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'

export default function PresidenteSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [displayName, setDisplayName] = useState('')

  useEffect(() => {
    if (user?.nombre && user?.apellido) {
      setDisplayName(`${user.nombre} ${user.apellido}`)
    }
  }, [user])

  const menuItems = [
    { href: '/presidente', label: 'Dashboard', icon: '📊' },
    { href: '/presidente/solicitudes', label: 'Solicitudes', icon: '📋' },
    { href: '/presidente/miembros', label: 'Miembros', icon: '👥' },
    { href: '/presidente/reportes', label: 'Reportes', icon: '📈' },
  ]

  const isActive = (href: string) => {
    if (href === '/presidente') {
      return pathname === '/presidente'
    }
    return pathname.startsWith(href)
  }

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedRole = e.target.value
    if (selectedRole === 'usuario') {
      router.push('/usuario')
    } else if (selectedRole === 'administrador') {
      router.push('/administrador')
    } else if (selectedRole === 'secretario') {
      router.push('/secretario')
    }
  }

  return (
    <aside className="presidente-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <span className="logo-icon">👑</span>
          <span className="logo-text">PRESIDENTE</span>
        </div>
      </div>

      {/* User Info */}
      <div className="sidebar-user">
        <div className="user-avatar">👤</div>
        <div className="user-info">
          <p className="user-name">{displayName}</p>
          <p className="user-role">Presidente</p>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="sidebar-nav">
        <ul className="nav-list">
          {menuItems.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`nav-link ${isActive(item.href) ? 'active' : ''}`}
              >
                <span className="link-icon">{item.icon}</span>
                <span className="link-text">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Role Switcher */}
      {user && user.roles && user.roles.length > 1 && (
        <div className="sidebar-roles">
          <label htmlFor="role-select">Cambiar rol:</label>
          <select
            id="role-select"
            onChange={handleRoleChange}
            value="presidente"
            className="role-select"
          >
            <option value="presidente">Presidente</option>
            {user.roles.some((r: any) => r.nombre === 'Usuario') && (
              <option value="usuario">Usuario</option>
            )}
            {user.roles.some((r: any) => r.nombre === 'Administrador') && (
              <option value="administrador">Administrador</option>
            )}
            {user.roles.some((r: any) => r.nombre === 'Secretario') && (
              <option value="secretario">Secretario</option>
            )}
          </select>
        </div>
      )}

      {/* Logout */}
      <div className="sidebar-footer">
        <button
          onClick={() => {
            logout()
            router.push('/login')
          }}
          className="logout-btn"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
