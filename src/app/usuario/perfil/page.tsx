'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './perfil.css'

type Perfil = {
  cc: string
  nombre: string
  apellido: string
  correo_electronico?: string
  telefono?: string
  contraseña?: string
  direccion?: string
  estado: string
  tipo_documento: string
  comuna: string
  barrio: string
}

export default function UsuarioPerfil() {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [editData, setEditData] = useState({
    correo_electronico: '',
    telefono: '',
    contraseña: '',
    direccion: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    fetchPerfil()
  }, [user])

  const fetchPerfil = async () => {
    try {
      if (!user?.id) return

      const { data: usuarioData, error: usuarioError } = await supabase
        .from('komerizo_usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

      if (usuarioError) throw usuarioError

      // Obtener tipo de documento
      let tipoDocumento = ''
      if (usuarioData.tipo_documento_id) {
        const { data: tipoData } = await supabase
          .from('komerizo_tipo_documento')
          .select('nombre')
          .eq('id', usuarioData.tipo_documento_id)
          .single()
        tipoDocumento = tipoData?.nombre || ''
      }

      // Obtener Comuna
      let comunaName = ''
      if (usuarioData.comuna_id) {
        const { data: comunaData } = await supabase
          .from('komerizo_comunas')
          .select('nombre')
          .eq('id', usuarioData.comuna_id)
          .single()
        comunaName = comunaData?.nombre || ''
      }

      // Obtener Barrio
      let barrioName = ''
      if (usuarioData.barrio_id) {
        const { data: barrioData } = await supabase
          .from('komerizo_barrios')
          .select('nombre')
          .eq('id', usuarioData.barrio_id)
          .single()
        barrioName = barrioData?.nombre || ''
      }

      const perfilData: Perfil = {
        cc: usuarioData.cc || '',
        nombre: usuarioData.nombre || '',
        apellido: usuarioData.apellido || '',
        correo_electronico: usuarioData.correo_electronico || '',
        telefono: usuarioData.telefono || '',
        contraseña: usuarioData.contrasena || '',
        direccion: usuarioData.direccion || '',
        estado: usuarioData.estado || '',
        tipo_documento: tipoDocumento,
        comuna: comunaName,
        barrio: barrioName,
      }

      setPerfil(perfilData)
      setEditData({
        correo_electronico: perfilData.correo_electronico,
        telefono: perfilData.telefono,
        contraseña: '',
        direccion: perfilData.direccion,
      })
    } catch (error) {
      console.error('Error al cargar perfil:', error)
      setMessage({ type: 'error', text: 'Error al cargar el perfil' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setMessage(null)

      if (!user?.id) return

      const updateData: any = {
        correo_electronico: editData.correo_electronico || null,
        telefono: editData.telefono || null,
        direccion: editData.direccion || null,
      }

      // Solo actualizar contraseña si se proporciona una nueva
      if (editData.contraseña && editData.contraseña.trim()) {
        if (editData.contraseña.length < 6) {
          setMessage({ type: 'error', text: 'La contraseña debe tener al menos 6 caracteres' })
          return
        }
        updateData.contrasena = editData.contraseña
      }

      const { error } = await supabase
        .from('komerizo_usuarios')
        .update(updateData)
        .eq('id', user.id)

      if (error) throw error

      // Actualizar datos en localStorage si cambió correo
      if (editData.correo_electronico !== perfil?.correo_electronico) {
        const updatedUser = { ...user, email: editData.correo_electronico }
        localStorage.setItem('komerizo_user', JSON.stringify(updatedUser))
      }

      setMessage({ type: 'success', text: 'Perfil actualizado exitosamente' })
      setShowPasswordInput(false)
      setEditData(prev => ({ ...prev, contraseña: '' }))
      
      // Recargar datos
      setTimeout(() => {
        fetchPerfil()
      }, 500)
    } catch (error: any) {
      console.error('Error al guardar:', error)
      setMessage({ type: 'error', text: error.message || 'Error al guardar los cambios' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="perfil-container">
        <div className="loading">Cargando perfil...</div>
      </div>
    )
  }

  if (!perfil) {
    return (
      <div className="perfil-container">
        <div className="error">No se encontró el perfil del usuario</div>
      </div>
    )
  }

  return (
    <div className="perfil-container">
      <div className="perfil-header">
        <h1>👤 Mi Perfil</h1>
        <p className="header-subtitle">Actualiza tu información personal</p>
      </div>

      {message && (
        <div className={`message ${message.type}`}>
          {message.type === 'success' ? '✅' : '❌'} {message.text}
        </div>
      )}

      {/* Datos de Solo Lectura */}
      <div className="perfil-section read-only-section">
        <h2>📋 Información de Identidad</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Tipo de Documento</label>
            <p className="info-value">{perfil.tipo_documento}</p>
          </div>
          <div className="info-item">
            <label>CC/Cédula</label>
            <p className="info-value">{perfil.cc}</p>
          </div>
        </div>
      </div>

      <div className="perfil-section read-only-section">
        <h2>👤 Datos Personales</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Nombre</label>
            <p className="info-value">{perfil.nombre}</p>
          </div>
          <div className="info-item">
            <label>Apellido</label>
            <p className="info-value">{perfil.apellido}</p>
          </div>
          <div className="info-item">
            <label>Estado</label>
            <p className={`info-value status-${perfil.estado}`}>{perfil.estado}</p>
          </div>
        </div>
      </div>

      <div className="perfil-section read-only-section">
        <h2>📍 Ubicación</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>Comuna</label>
            <p className="info-value">{perfil.comuna}</p>
          </div>
          <div className="info-item">
            <label>Barrio</label>
            <p className="info-value">{perfil.barrio}</p>
          </div>
        </div>
      </div>

      {/* Datos Editables */}
      <div className="perfil-section editable-section">
        <h2>📧 Información de Contacto</h2>
        <div className="form-group">
          <label htmlFor="correo">Correo Electrónico</label>
          <input
            id="correo"
            type="email"
            value={editData.correo_electronico}
            onChange={(e) =>
              setEditData({ ...editData, correo_electronico: e.target.value })
            }
            placeholder="tu@email.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            type="tel"
            value={editData.telefono}
            onChange={(e) =>
              setEditData({ ...editData, telefono: e.target.value })
            }
            placeholder="3001234567"
          />
        </div>
      </div>

      <div className="perfil-section editable-section">
        <h2>🏠 Dirección</h2>
        <div className="form-group">
          <label htmlFor="direccion">Dirección</label>
          <textarea
            id="direccion"
            value={editData.direccion}
            onChange={(e) =>
              setEditData({ ...editData, direccion: e.target.value })
            }
            placeholder="Ej: Calle 5 # 10-20, Apto 301"
            rows={3}
          />
        </div>
      </div>

      <div className="perfil-section editable-section">
        <h2>🔐 Seguridad</h2>
        {!showPasswordInput ? (
          <button
            className="btn-change-password"
            onClick={() => setShowPasswordInput(true)}
          >
            ✏️ Cambiar Contraseña
          </button>
        ) : (
          <div className="password-section">
            <div className="form-group">
              <label htmlFor="password">Nueva Contraseña</label>
              <div className="password-input-group">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={editData.contraseña}
                  onChange={(e) =>
                    setEditData({ ...editData, contraseña: e.target.value })
                  }
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
              <small>Dejar en blanco para mantener tu contraseña actual</small>
            </div>
            <button
              className="btn-cancel-password"
              onClick={() => {
                setShowPasswordInput(false)
                setEditData(prev => ({ ...prev, contraseña: '' }))
              }}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>

      <div className="perfil-footer">
        <button
          className="btn-save"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '💾 Guardando...' : '💾 Guardar Cambios'}
        </button>
      </div>
    </div>
  )
}
