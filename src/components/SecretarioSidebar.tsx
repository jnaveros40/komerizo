'use client'

import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import './SecretarioSidebar.css'

export default function SecretarioSidebar({ user }: { user: any }) {
  const pathname = usePathname()

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
      label: 'Comunas',
      href: '/secretario/comunas',
      icon: '📍',
    },
    {
      label: 'Roles',
      href: '/secretario/roles',
      icon: '🏷️',
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

  const { signOut } = useAuth()

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
