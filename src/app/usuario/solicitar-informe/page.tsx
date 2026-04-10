'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import '../usuario.css'

type Rol = {
  id: number
  nombre: string
  descripcion: string
}

type Solicitud = {
  id: number
  destinatario_rol_id: number
  destinatario_rol_nombre?: string
  mensaje_solicitud: string
  fecha_solicitud: string
  mensaje_respuesta: string
  fecha_respuesta: string | null
  estado: string
}

export default function SolicitarInformePage() {
  const { user } = useAuth()
  const [roles, setRoles] = useState<Rol[]>([])
  const [formData, setFormData] = useState({
    destinatario_rol_id: '',
    mensaje_solicitud: '',
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [rolesLoading, setRolesLoading] = useState(true)
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [solicitudesLoading, setSolicitudesLoading] = useState(true)

  useEffect(() => {
    fetchRoles()
    fetchSolicitudes()
  }, [user])

  const fetchSolicitudes = async () => {
    if (!user?.id) return

    try {
      setSolicitudesLoading(true)
      const { data, error } = await supabase
        .from('komerizo_solicitud_informes')
        .select('*, komerizo_roles(nombre)')
        .eq('usuario_id', user.id)
        .order('fecha_solicitud', { ascending: false })

      if (error) throw error
      
      // Mapear los datos para incluir el nombre del rol
      const solicitudesConRol = (data || []).map((sol: any) => ({
        ...sol,
        destinatario_rol_nombre: sol.komerizo_roles?.nombre || `Rol ${sol.destinatario_rol_id}`,
      }))
      
      setSolicitudes(solicitudesConRol)
    } catch (error) {
      console.error('Error al cargar solicitudes:', error)
    } finally {
      setSolicitudesLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      setRolesLoading(true)
      const { data, error } = await supabase
        .from('komerizo_roles')
        .select('id, nombre, descripcion')
        .order('nombre', { ascending: true })

      if (error) throw error
      setRoles(data || [])
    } catch (error) {
      console.error('Error al cargar roles:', error)
    } finally {
      setRolesLoading(false)
    }
  }

  const handleInputChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user?.id) {
      setMessage('❌ Error: Usuario no autenticado')
      return
    }

    if (!formData.destinatario_rol_id || !formData.mensaje_solicitud.trim()) {
      setMessage('❌ Por favor completa todos los campos')
      return
    }

    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('komerizo_solicitud_informes')
        .insert([
          {
            usuario_id: user.id,
            destinatario_rol_id: parseInt(formData.destinatario_rol_id),
            mensaje_solicitud: formData.mensaje_solicitud.trim(),
            estado: 'Pendiente',
            destinatario_id: 0,
          },
        ])

      if (error) throw error

      setMessage('✅ Solicitud enviada correctamente')
      setFormData({
        destinatario_rol_id: '',
        mensaje_solicitud: '',
      })

      // Recargar solicitudes
      fetchSolicitudes()

      // Limpiar mensaje después de 3 segundos
      setTimeout(() => {
        setMessage('')
      }, 3000)
    } catch (error: any) {
      console.error('Error al enviar solicitud:', error)
      setMessage(`❌ Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <h1>📋 Solicitar Informe</h1>
        <p className="header-subtitle">Envía una solicitud a la directiva</p>
      </div>

      {message && (
        <div className={`info-message ${message.includes('✅') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      <div className="info-card">
        <div className="info-section">
          <h3>Nueva Solicitud de Informe</h3>

          <form onSubmit={handleSubmit} className="solicitud-form">
            <div className="form-group">
              <label htmlFor="destinatario_rol_id">
                Destinatario (Rol): <span className="required">*</span>
              </label>
              {rolesLoading ? (
                <div className="loading-select">Cargando roles...</div>
              ) : (
                <select
                  id="destinatario_rol_id"
                  name="destinatario_rol_id"
                  value={formData.destinatario_rol_id}
                  onChange={handleInputChange}
                  required
                  disabled={loading}
                  className="form-select"
                >
                  <option value="">-- Selecciona un rol --</option>
                  {roles.map((rol) => (
                    <option key={rol.id} value={rol.id}>
                      {rol.nombre} - {rol.descripcion}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="mensaje_solicitud">
                Mensaje: <span className="required">*</span>
              </label>
              <textarea
                id="mensaje_solicitud"
                name="mensaje_solicitud"
                value={formData.mensaje_solicitud}
                onChange={handleInputChange}
                placeholder="Describe brevemente qué informe necesitas..."
                required
                disabled={loading}
                className="form-textarea"
                rows={6}
              />
              <small className="form-helper">
                {formData.mensaje_solicitud.length}/500 caracteres
              </small>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                disabled={loading || rolesLoading}
                className="btn-submit"
              >
                {loading ? '⏳ Enviando...' : '📤 Enviar Solicitud'}
              </button>
            </div>
          </form>

          <div className="info-note" style={{ marginTop: '2rem' }}>
            <p>
              <strong>Nota:</strong> Tu solicitud será enviada al rol seleccionado. La directiva de tu JAC
              revisará tu solicitud y te proporcionará el informe en el tiempo establecido.
            </p>
          </div>
        </div>
      </div>

      {/* Sección de Solicitudes Previas */}
      <div className="info-card" style={{ marginTop: '2rem' }}>
        <div className="info-section">
          <h3>📜 Mis Solicitudes de Informe</h3>

          {solicitudesLoading ? (
            <div className="loading-state">
              <p>⏳ Cargando solicitudes...</p>
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No hay solicitudes</h3>
              <p>Aún no has enviado ninguna solicitud de informe.</p>
            </div>
          ) : (
            <div className="solicitudes-container">
              {solicitudes.map((solicitud) => (
                <div key={solicitud.id} className="solicitud-card">
                  <div className="solicitud-header">
                    <div className="solicitud-row">
                      <span className="label">Solicitado a:</span>
                      <span className="value">{solicitud.destinatario_rol_nombre || `Rol ${solicitud.destinatario_rol_id}`}</span>
                    </div>
                    <span
                      className={`status-badge ${
                        solicitud.estado === 'Respondido'
                          ? 'status-respondido'
                          : 'status-pendiente'
                      }`}
                    >
                      {solicitud.estado}
                    </span>
                  </div>

                  <div className="solicitud-body">
                    <div className="solicitud-row">
                      <span className="label">Tu Solicitud (Fecha: {new Date(solicitud.fecha_solicitud).toLocaleDateString()}):</span>
                    </div>
                    <p className="solicitud-mensaje">{solicitud.mensaje_solicitud}</p>

                    {solicitud.estado === 'Respondido' && (
                      <>
                        <div className="solicitud-divider"></div>
                        <div className="solicitud-row">
                          <span className="label">Respuesta (Fecha: {new Date(solicitud.fecha_respuesta || '').toLocaleDateString()}):</span>
                        </div>
                        <p className="solicitud-respuesta">{solicitud.mensaje_respuesta}</p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
