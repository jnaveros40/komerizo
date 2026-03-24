'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SecretarioDashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    usuariosActivos: 0,
    totalRoles: 0,
    totalComunas: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Obtener estadísticas
        const [usuariosRes, rolesRes, comunasRes] = await Promise.all([
          supabase
            .from('komerizo_usuarios')
            .select('id', { count: 'exact' }),
          supabase
            .from('komerizo_roles')
            .select('id', { count: 'exact' }),
          supabase
            .from('komerizo_comunas')
            .select('id', { count: 'exact' }),
        ])

        const usuariosActivos = await supabase
          .from('komerizo_usuarios')
          .select('id', { count: 'exact' })
          .eq('estado', 'activo')

        setStats({
          totalUsuarios: usuariosRes.count || 0,
          usuariosActivos: usuariosActivos.count || 0,
          totalRoles: rolesRes.count || 0,
          totalComunas: comunasRes.count || 0,
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="secretario-dashboard">
      <h1>Panel de Control - Secretario</h1>

      <div className="welcome-section">
        <p>
          Bienvenido, <strong>{user?.nombre} {user?.apellido}</strong>
        </p>
        <p className="subtitle">
          Tu rol: <span className="badge">Secretario (Admin)</span>
        </p>
      </div>

      {loading ? (
        <p>Cargando estadísticas...</p>
      ) : (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <p className="stat-label">Total de Usuarios</p>
              <p className="stat-value">{stats.totalUsuarios}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <p className="stat-label">Usuarios Activos</p>
              <p className="stat-value">{stats.usuariosActivos}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">🏷️</div>
            <div className="stat-content">
              <p className="stat-label">Roles Definidos</p>
              <p className="stat-value">{stats.totalRoles}</p>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">📍</div>
            <div className="stat-content">
              <p className="stat-label">Comunas</p>
              <p className="stat-value">{stats.totalComunas}</p>
            </div>
          </div>
        </div>
      )}

      <section className="quick-actions">
        <h2>Acciones Rápidas</h2>
        <div className="actions-grid">
          <a href="/secretario/usuarios" className="action-btn">
            <span>👥</span>
            <span>Gestionar Usuarios</span>
          </a>
          <a href="/secretario/comunas" className="action-btn">
            <span>📍</span>
            <span>Gestionar Comunas</span>
          </a>
          <a href="/secretario/reportes" className="action-btn">
            <span>📊</span>
            <span>Ver Reportes</span>
          </a>
          <a href="/secretario/configuracion" className="action-btn">
            <span>⚙️</span>
            <span>Configuración</span>
          </a>
        </div>
      </section>
    </div>
  )
}
