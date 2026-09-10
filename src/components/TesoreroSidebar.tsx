/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/immutability, react-hooks/exhaustive-deps */
'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import { supabase } from '@/lib/supabase'
import './TesoreroSidebar.css'

export default function TesoreroSidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const { signOut } = useAuth()
  const [showRoleDropdown, setShowRoleDropdown] = useState(false)
  const [userRoles, setUserRoles] = useState<Array<{ id: number; nombre: string }>>(user?.roles || [])
  const menuItems = [
    { label: 'Dashboard', href: '/tesorero', icon: '📊' },
    { label: 'Reuniones', href: '/tesorero/reuniones', icon: '📅' },
    { label: 'Informes', href: '/tesorero/informes', icon: '📄' },
    { label: 'Inventario', href: '/tesorero/inventario', icon: '📦' },
    { label: 'Salón Comunal', href: '/tesorero/salon', icon: '🏛️' },
    { label: 'Ingresos', href: '/tesorero/ingresos', icon: '💵' },
    { label: 'Ventas', href: '/tesorero/ventas', icon: '🛒' },
    { label: 'Bono solidario', href: '/tesorero/bonos', icon: '🎟️' },
    { label: 'Egresos por revisar', href: '/tesorero/egresos', icon: '🧾' },
    { label: 'Tesorería', href: '/tesorero/tesoreria', icon: '💰' },
    { label: 'Reportes', href: '/tesorero/reportes', icon: '📈' },
  ]

  useEffect(() => { if (showRoleDropdown && user?.id) loadUserRoles() }, [showRoleDropdown])
  const loadUserRoles = async () => {
    const { data: relations } = await supabase.from('komerizo_usuario_roles').select('rol_id').eq('usuario_id', user.id)
    const ids = relations?.map((relation: any) => relation.rol_id) || []
    if (!ids.length) return
    const { data: roles } = await supabase.from('komerizo_roles').select('id,nombre').in('id', ids).order('nombre')
    if (roles) { setUserRoles(roles); localStorage.setItem('komerizo_user', JSON.stringify({ ...user, roles })) }
  }
  const isActive = (href: string) => href === '/tesorero' ? pathname === href : pathname.startsWith(href)
  const handleRoleChange = (roleNombre: string) => {
    localStorage.setItem('komerizo_user', JSON.stringify({ ...user, activeRole: roleNombre }))
    const redirectUrl = getRedirectUrlByRole([{ id: 0, nombre: roleNombre }])
    setShowRoleDropdown(false)
    if (redirectUrl) window.location.href = redirectUrl
  }
  return <aside className="tesorero-sidebar"><div className="sidebar-header"><div className="logo"><span className="logo-icon">💚</span><span className="logo-text">Komerizo</span></div></div><nav className="sidebar-nav"><div className="nav-section"><p className="nav-section-title">MENÚ PRINCIPAL</p><ul>{menuItems.map(item => <li key={item.href}><Link href={item.href} className={`nav-link ${isActive(item.href) ? 'active' : ''}`}><span className="nav-icon">{item.icon}</span><span className="nav-label">{item.label}</span></Link></li>)}</ul></div></nav><div className="sidebar-footer">{userRoles.length > 1 && <div className="role-selector"><div className="role-selector-label">Rol Actual</div><div className="role-dropdown-container"><button className="role-dropdown-btn" onClick={() => setShowRoleDropdown(!showRoleDropdown)}><span className="role-icon">👤</span><span className="role-name">Tesorero</span><span className="dropdown-arrow">▼</span></button>{showRoleDropdown && <div className="role-dropdown-menu">{userRoles.map(role => <button key={role.id} className="role-option" onClick={() => handleRoleChange(role.nombre)}><span className="role-option-name">{role.nombre}</span><span className="role-option-badge">●</span></button>)}</div>}</div></div>}<div className="user-info"><div className="user-avatar">{user?.nombre?.charAt(0).toUpperCase()}</div><div className="user-details"><p className="user-name">{user?.nombre} {user?.apellido}</p><p className="user-role">Tesorero (Admin)</p></div></div><button className="logout-btn" onClick={signOut} title="Cerrar sesión">🚪</button></div></aside>
}
