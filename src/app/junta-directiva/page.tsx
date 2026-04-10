'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './junta-directiva.css'

export default function JuntaDirectivaPage() {
  const { user } = useAuth()
  const [comunaInfo, setComunaInfo] = useState<{ nombre: string; barrio: string } | null>(null)

  useEffect(() => {
    if (user?.id) {
      fetchComunaInfo()
    }
  }, [user?.id])

  const fetchComunaInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('komerizo_usuarios')
        .select('comuna, barrio')
        .eq('id', user?.id)
        .single()

      if (data) {
        setComunaInfo({
          nombre: data.comuna || 'No disponible',
          barrio: data.barrio || 'No disponible',
        })
      }
    } catch (error) {
      console.error('Error fetching comuna info:', error)
    }
  }

  return (
    <div className="junta-directiva-page">
      <div className="junta-directiva-header">
        <h1>Panel de Junta Directiva</h1>
        <p>Bienvenido a tu panel de control</p>
      </div>

      <div className="junta-directiva-grid">
        {comunaInfo && (
          <div className="location-card">
            <div className="location-icon">
              <span>📍</span>
            </div>
            <div className="location-content">
              <p className="location-label">Tu Comuna</p>
              <h3 className="location-name">{comunaInfo.nombre}</h3>
              <p className="location-barrio">{comunaInfo.barrio}</p>
            </div>
          </div>
        )}

        <div className="welcome-card">
          <h2>Bienvenido</h2>
          <p>Como miembro de la Junta Directiva, tienes acceso a herramientas especializadas para la gestión y toma de decisiones de la organización.</p>
        </div>

        <div className="quick-access-card">
          <h3>Acceso Rápido</h3>
          <ul>
            <li>📋 Revisar reportes y documentos</li>
            <li>👥 Gestionar miembros de la junta</li>
            <li>📊 Ver estadísticas y datos</li>
            <li>🗳️ Participar en decisiones importantes</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
