'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import './asistencia.css'

type Reunion = {
  id: number
  titulo: string
  tipo_reunion: string
  fecha_reunion: string
  hora_inicio: string
  lugar: string
  es_obligatoria: boolean
  estado: string
}

type Confirmacion = {
  id: number
  reunion: Reunion
  estado_confirmacion: string
  observaciones: string
  fecha_confirmacion: string | null
}

export default function UsuarioAsistencia() {
  const { user } = useAuth()
  const [asistencias, setAsistencias] = useState<Confirmacion[]>([])
  const [loading, setLoading] = useState(true)
  const [justificandoId, setJustificandoId] = useState<number | null>(null)
  const [justificacionTexto, setJustificacionTexto] = useState('')

  useEffect(() => {
    if (user?.id) {
      fetchAsistencias()
    }
  }, [user])

  const fetchAsistencias = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('komerizo_reuniones_confirmaciones')
        .select(`
          id,
          estado_confirmacion,
          observaciones,
          fecha_confirmacion,
          reunion:komerizo_reuniones (
            id,
            titulo,
            tipo_reunion,
            fecha_reunion,
            hora_inicio,
            lugar,
            es_obligatoria,
            estado
          )
        `)
        .eq('usuario_id', user?.id)
        .order('reunion(fecha_reunion)', { ascending: false })

      if (error) throw error

      if (data) {
        // Mapear los datos al tipo esperado
        const formatData = data.map((item: any) => ({
          ...item,
          reunion: Array.isArray(item.reunion) ? item.reunion[0] : item.reunion
        }))
        setAsistencias(formatData)
      }
    } catch (error) {
      console.error('Error cargando asistencias:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleJustificar = async (confirmacionId: number) => {
    if (!justificacionTexto.trim()) return

    try {
      const { error } = await supabase
        .from('komerizo_reuniones_confirmaciones')
        .update({
          estado_confirmacion: 'rechazado',
          observaciones: justificacionTexto,
          fecha_confirmacion: new Date().toISOString()
        })
        .eq('id', confirmacionId)

      if (error) throw error

      setJustificandoId(null)
      setJustificacionTexto('')
      fetchAsistencias()
      alert('Justificación enviada exitosamente.')
    } catch (error) {
      console.error('Error al justificar:', error)
      alert('Hubo un error al enviar la justificación.')
    }
  }

  const handleConfirmarAsistencia = async (confirmacionId: number) => {
    try {
      const { error } = await supabase
        .from('komerizo_reuniones_confirmaciones')
        .update({
          estado_confirmacion: 'confirmado',
          observaciones: '',
          fecha_confirmacion: new Date().toISOString()
        })
        .eq('id', confirmacionId)

      if (error) throw error

      fetchAsistencias()
      alert('Asistencia confirmada exitosamente.')
    } catch (error) {
      console.error('Error al confirmar:', error)
    }
  }

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case 'confirmado':
        return <span className="badge confirmada">Asistiré</span>
      case 'rechazado':
        return <span className="badge excusada">Justificado</span>
      case 'asistio':
        return <span className="badge asistio">Asistió</span>
      case 'ausente':
        return <span className="badge falta">Falta Injustificada</span>
      default:
        return <span className="badge pendiente">Pendiente</span>
    }
  }

  const isFutureMeeting = (fecha: string) => {
    return new Date(fecha) >= new Date(new Date().setHours(0,0,0,0))
  }

  return (
    <div className="asistencia-container">
      <div className="asistencia-header">
        <h1>📅 Mi Asistencia</h1>
        <p className="header-subtitle">Historial de reuniones, asambleas y control de asistencia</p>
      </div>

      <div className="asistencia-grid">
        {loading ? (
          <div className="loading">Cargando tu historial de asistencia...</div>
        ) : asistencias.length === 0 ? (
          <div className="empty-state">No tienes reuniones asignadas.</div>
        ) : (
          asistencias.map((item) => (
            <div key={item.id} className="reunion-card">
              <div className="reunion-card-header">
                <span className="reunion-tipo">{item.reunion.tipo_reunion}</span>
                {item.reunion.es_obligatoria && <span className="badge-obligatorio">Obligatoria</span>}
              </div>
              <h3 className="reunion-titulo">{item.reunion.titulo}</h3>
              
              <div className="reunion-details">
                <div className="detail-item">
                  <span className="detail-icon">📆</span>
                  <span>{new Date(item.reunion.fecha_reunion).toLocaleDateString()} a las {item.reunion.hora_inicio}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-icon">📍</span>
                  <span>{item.reunion.lugar || 'Lugar por definir'}</span>
                </div>
              </div>

              <div className="reunion-status-section">
                <div className="status-label">Estado de asistencia:</div>
                {getStatusBadge(item.estado_confirmacion)}
                
                {item.observaciones && (
                  <div className="justificacion-texto">
                    <strong>Tu nota:</strong> {item.observaciones}
                  </div>
                )}
              </div>

              {isFutureMeeting(item.reunion.fecha_reunion) && 
               (item.estado_confirmacion === 'sin_responder' || item.estado_confirmacion === 'pendiente') && (
                <div className="reunion-actions">
                  {justificandoId === item.id ? (
                    <div className="justificacion-form">
                      <textarea 
                        placeholder="Escribe el motivo de tu inasistencia..."
                        value={justificacionTexto}
                        onChange={(e) => setJustificacionTexto(e.target.value)}
                        className="justificacion-input"
                        rows={3}
                      />
                      <div className="justificacion-actions">
                        <button 
                          className="btn-cancelar" 
                          onClick={() => {
                            setJustificandoId(null)
                            setJustificacionTexto('')
                          }}
                        >
                          Cancelar
                        </button>
                        <button 
                          className="btn-enviar"
                          onClick={() => handleJustificar(item.id)}
                          disabled={!justificacionTexto.trim()}
                        >
                          Enviar Justificación
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="action-buttons">
                      <button 
                        className="btn-confirmar"
                        onClick={() => handleConfirmarAsistencia(item.id)}
                      >
                        ✅ Confirmar Asistencia
                      </button>
                      <button 
                        className="btn-justificar"
                        onClick={() => setJustificandoId(item.id)}
                      >
                        ❌ No podré asistir
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
