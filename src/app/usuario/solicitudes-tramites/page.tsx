'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import './solicitudes-tramites.css'

type SolicitudTramite = {
  id: number
  tipo_solicitud: string
  detalles: any
  estado: string
  respuesta: string
  fecha_solicitud: string
  fecha_respuesta: string
}

export default function SolicitudesTramitesUsuario() {
  const { user } = useAuth()
  const [solicitudes, setSolicitudes] = useState<SolicitudTramite[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [tipoSolicitud, setTipoSolicitud] = useState('cambio_comision')
  const [motivo, setMotivo] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (user?.id) {
      fetchSolicitudes()
    }
  }, [user])

  const fetchSolicitudes = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('komerizo_solicitudes_tramites')
        .select('*')
        .eq('usuario_id', user?.id)
        .order('fecha_solicitud', { ascending: false })

      if (error) {
        // If table doesn't exist yet, just ignore error for now
        console.warn('Error fetching solicitudes:', error)
        setSolicitudes([])
      } else {
        setSolicitudes(data || [])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!motivo.trim()) return

    try {
      setSubmitting(true)
      const { error } = await supabase
        .from('komerizo_solicitudes_tramites')
        .insert({
          usuario_id: user?.id,
          tipo_solicitud: tipoSolicitud,
          detalles: { motivo }
        })

      if (error) throw error

      alert('Solicitud enviada correctamente.')
      setShowModal(false)
      setMotivo('')
      fetchSolicitudes()
    } catch (error) {
      console.error('Error enviando solicitud:', error)
      alert('Error enviando la solicitud. Asegúrate de que la tabla de la base de datos esté creada.')
    } finally {
      setSubmitting(false)
    }
  }

  const getBadgeClass = (estado: string) => {
    switch(estado) {
      case 'aprobado': return 'badge-success'
      case 'rechazado': return 'badge-danger'
      case 'en_revision': return 'badge-warning'
      default: return 'badge-secondary'
    }
  }

  const formatTipo = (tipo: string) => {
    return tipo.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  return (
    <div className="tramites-container">
      <div className="tramites-header">
        <h1>📝 Solicitudes y Trámites</h1>
        <p className="header-subtitle">Gestiona tus peticiones a la Junta (Cambio de comisión, desafiliación, etc)</p>
        <button className="btn-nueva-solicitud" onClick={() => setShowModal(true)}>
          + Nueva Solicitud
        </button>
      </div>

      <div className="tramites-lista">
        {loading ? (
          <div className="loading">Cargando solicitudes...</div>
        ) : solicitudes.length === 0 ? (
          <div className="empty-state">No has realizado ninguna solicitud aún.</div>
        ) : (
          <div className="table-responsive">
            <table className="tramites-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo de Trámite</th>
                  <th>Estado</th>
                  <th>Respuesta</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(solicitud => (
                  <tr key={solicitud.id}>
                    <td>{new Date(solicitud.fecha_solicitud).toLocaleDateString()}</td>
                    <td>
                      <strong>{formatTipo(solicitud.tipo_solicitud)}</strong>
                      <div className="solicitud-motivo">
                        {solicitud.detalles?.motivo}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${getBadgeClass(solicitud.estado)}`}>
                        {solicitud.estado.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {solicitud.respuesta ? (
                        <div className="respuesta-texto">{solicitud.respuesta}</div>
                      ) : (
                        <span className="sin-respuesta">Pendiente de revisión</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Nueva Solicitud</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Tipo de Trámite</label>
                <select 
                  value={tipoSolicitud}
                  onChange={(e) => setTipoSolicitud(e.target.value)}
                  className="form-control"
                >
                  <option value="cambio_comision">Cambio de Comisión de Trabajo</option>
                  <option value="desafiliacion">Desafiliación Voluntaria</option>
                  <option value="certificado_especial">Certificado Especial</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Motivo o Detalles de la Solicitud</label>
                <textarea 
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Explica brevemente tu solicitud..."
                  className="form-control"
                  rows={4}
                  required
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn-submit" disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
