'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import './AdministradorSidebar.css'

export default function AdministradorSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const { signOut } = useAuth()

  const menuItems = [
    { href: '/administrador', label: '📊 Dashboard', icon: '📊' },
    { href: '/administrador/usuarios', label: '👥 Usuarios', icon: '👥' },
    { href: '/administrador/comunas', label: '🏘️ Comunas', icon: '🏘️' },
    { href: '/administrador/barrios', label: '🏢 Barrios', icon: '🏢' },
    { href: '/administrador/configuracion', label: '⚙️ Configuración', icon: '⚙️' },
  ]

  const isActive = (href: string) => {
    if (href === '/administrador') {
      return pathname === '/administrador'
    }
    return pathname.startsWith(href)
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
