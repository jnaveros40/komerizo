'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './usuario.css'

type Evento = {
  id: number
  titulo: string
  descripcion?: string
  fecha: string
  ubicacion?: string
  estado: string
}

type Directiva = {
  id: number
  nombre: string
  cargo: string
  telefono?: string
  correo?: string
}

export default function UsuarioDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [comunaName, setComunaName] = useState('')
  const [barrioName, setBarrioName] = useState('')
  const [eventos, setEventos] = useState<Evento[]>([])
  const [directiva, setDirectiva] = useState<Directiva[]>([])

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

      // Placeholder para eventos futuros
      setEventos([])

      // Placeholder para directiva futura
      setDirectiva([])
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <h1>👤 Mi Zona</h1>
        <p className="header-subtitle">Bienvenido(a), {user?.nombre}</p>
      </div>

      {/* Información de ubicación */}
      <div className="location-card">
        <div className="location-info">
          <h3>📍 Mi Comunidad</h3>
          <div className="location-details">
            <div className="detail-item">
              <span className="label">Comuna:</span>
              <span className="value">{comunaName || 'Cargando...'}</span>
            </div>
            <div className="detail-item">
              <span className="label">Barrio:</span>
              <span className="value">{barrioName || 'Cargando...'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sección de estadísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <p className="stat-label">Información Personal</p>
            <p className="stat-value">Ver y editar</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📢</div>
          <div className="stat-content">
            <p className="stat-label">Anuncios</p>
            <p className="stat-value">De tu zona</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <p className="stat-label">Eventos</p>
            <p className="stat-value">Próximas actividades</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <p className="stat-label">Directiva</p>
            <p className="stat-value">Contactos de tu JAC</p>
          </div>
        </div>
      </div>

      {/* Sección de bienvenida */}
      <div className="welcome-section">
        <h3>Bienvenido a tu portal comunitario</h3>
        <p>
          Desde aquí puedes ver información relevante sobre tu comunidad, eventos próximos,
          contactos de la directiva y más. Este portal te mantiene conectado con tu JAC
          (Junta de Acción Comunal).
        </p>
      </div>
    </div>
  )
}
