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

  useEffect(() => {
    fetchRoles()
  }, [])

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
    </div>
  )
}
