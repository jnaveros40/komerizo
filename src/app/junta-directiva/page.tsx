'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './junta-directiva.css'

export default function JuntaDirectivaPage() {
  const { user } = useAuth()
  const [comunaName, setComunaName] = useState('')
  const [barrioName, setBarrioName] = useState('')
  const [usuarioData, setUsuarioData] = useState<any>(null)

  useEffect(() => {
    if (user?.id) {
      fetchUserData()
    }
  }, [user?.id])

  const fetchUserData = async () => {
    try {
      // Obtener datos del usuario
      const { data: userData, error: userError } = await supabase
        .from('komerizo_usuarios')
        .select('*')
        .eq('id', user?.id)
        .single()

      if (userError) throw userError
      setUsuarioData(userData)

      // Obtener nombre de la comuna
      if (userData?.comuna_id) {
        const { data: comunaData } = await supabase
          .from('komerizo_comunas')
          .select('nombre')
          .eq('id', userData.comuna_id)
          .single()
        setComunaName(comunaData?.nombre || 'No disponible')
      }

      // Obtener nombre del barrio
      if (userData?.barrio_id) {
        const { data: barrioData } = await supabase
          .from('komerizo_barrios')
          .select('nombre')
          .eq('id', userData.barrio_id)
          .single()
        setBarrioName(barrioData?.nombre || 'No disponible')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  return (
    <div className="junta-directiva-page">
      <div className="junta-directiva-header">
        <h1>Panel de Junta Directiva</h1>
        <p>Bienvenido a tu panel de control</p>
      </div>

      <div className="junta-directiva-grid">
        {usuarioData && (
          <div className="location-card">
            <div className="location-icon">
              <span>📍</span>
            </div>
            <div className="location-content">
              <p className="location-label">Tu Comuna</p>
              <h3 className="location-name">{comunaName}</h3>
              <p className="location-barrio">{barrioName}</p>
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
