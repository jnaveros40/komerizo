'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdministradorDashboard() {
  const [stats, setStats] = useState({
    totalUsuarios: 0,
    usuariosActivos: 0,
    totalComunas: 0,
    totalBarrios: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Total de usuarios
        const { count: totalUsuarios } = await supabase
          .from('komerizo_usuarios')
          .select('*', { count: 'exact', head: true })

        // Usuarios activos
        const { count: usuariosActivos } = await supabase
          .from('komerizo_usuarios')
          .select('*', { count: 'exact', head: true })
          .eq('estado', 'activo')

        // Total de comunas
        const { count: totalComunas } = await supabase
          .from('komerizo_comunas')
          .select('*', { count: 'exact', head: true })

        // Total de barrios
        const { count: totalBarrios } = await supabase
          .from('komerizo_barrios')
          .select('*', { count: 'exact', head: true })

        setStats({
          totalUsuarios: totalUsuarios || 0,
          usuariosActivos: usuariosActivos || 0,
          totalComunas: totalComunas || 0,
          totalBarrios: totalBarrios || 0,
        })
      } catch (error) {
        console.error('Error al cargar estadísticas:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="administrador-loading-full">
        <p>Cargando estadísticas...</p>
      </div>
    )
  }

  return (
    <div className="administrador-dashboard">
      <div className="dashboard-header">
        <h1>Panel de Administración</h1>
        <p>Gestión integral del sistema</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card usuarios">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <h3>Total de Usuarios</h3>
            <p className="stat-number">{stats.totalUsuarios}</p>
          </div>
        </div>

        <div className="stat-card activos">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <h3>Usuarios Activos</h3>
            <p className="stat-number">{stats.usuariosActivos}</p>
          </div>
        </div>

        <div className="stat-card comunas">
          <div className="stat-icon">🏘️</div>
          <div className="stat-content">
            <h3>Total de Comunas</h3>
            <p className="stat-number">{stats.totalComunas}</p>
          </div>
        </div>

        <div className="stat-card barrios">
          <div className="stat-icon">🏢</div>
          <div className="stat-content">
            <h3>Total de Barrios</h3>
            <p className="stat-number">{stats.totalBarrios}</p>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Acciones Rápidas</h2>
        <div className="actions-grid">
          <button className="action-btn">
            <span className="btn-icon">👤</span>
            <span className="btn-text">Gestionar Usuarios</span>
          </button>
          <button className="action-btn">
            <span className="btn-icon">🏘️</span>
            <span className="btn-text">Gestionar Comunas</span>
          </button>
          <button className="action-btn">
            <span className="btn-icon">🏢</span>
            <span className="btn-text">Gestionar Barrios</span>
          </button>
          <button className="action-btn">
            <span className="btn-icon">⚙️</span>
            <span className="btn-text">Configuración</span>
          </button>
        </div>
      </div>
    </div>
  )
}
