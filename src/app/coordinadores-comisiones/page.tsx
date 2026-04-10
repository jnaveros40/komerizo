'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './coordinadores-comisiones.css'

export default function CoordinadoresComisionesDashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [comunaName, setComunaName] = useState('')
  const [barrioName, setBarrioName] = useState('')

  useEffect(() => {
    fetchUserData()
  }, [user])

  const fetchUserData = async () => {
    try {
      setLoading(true)
      if (!user?.comuna_id || !user?.barrio_id) return

      // Obtener nombres de Comuna y Barrio
      const { data: comunaData } = await supabase
        .from('komerizo_comunas')
        .select('nombre')
        .eq('id', user.comuna_id)
        .single()

      const { data: barrioData } = await supabase
        .from('komerizo_barrios')
        .select('nombre')
        .eq('id', user.barrio_id)
        .single()

      setComunaName(comunaData?.nombre || '')
      setBarrioName(barrioData?.nombre || '')
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="coordinadores-comisiones-loading"><p>Cargando dashboard...</p></div>
  }

  return (
    <div className="coordinadores-comisiones-container">
      <div className="coordinadores-comisiones-header">
        <h1>🏗️ Dashboard Coordinador de Comisiones</h1>
        <p className="header-subtitle">Bienvenido(a), {user?.nombre}</p>
      </div>

      {/* Información de ubicación */}
      <div className="location-card">
        <h3>Mi Comunidad</h3>
        <div className="location-info">
          <div className="info-item">
            <span className="info-label">Comuna:</span>
            <span className="info-value">{comunaName}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Barrio:</span>
            <span className="info-value">{barrioName}</span>
          </div>
        </div>
      </div>

      {/* Placeholder para contenido futuro */}
      <div className="dashboard-content">
        <p>Aquí irá el contenido del dashboard de Coordinadores de Comisiones...</p>
      </div>
    </div>
  )
}
