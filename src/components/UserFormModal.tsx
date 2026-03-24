'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import './UserFormModal.css'

type Usuario = {
  id?: number
  cc: string
  nombre: string
  apellido: string
  correo_electronico?: string
  telefono?: string
  estado: string
  tipo_documento_id?: number
  comuna_id?: number | null
  barrio_id?: number | null
  contrasena?: string
  roles?: Array<{ id: number; nombre: string }>
}

type TipoDocumento = {
  id: number
  nombre: string
  abreviatura: string
}

type Comuna = {
  id: number
  nombre: string
}

type Barrio = {
  id: number
  nombre: string
  comuna_id: number
}

type UserFormModalProps = {
  usuario: Usuario | null
  onClose: () => void
  onSave: () => void
  isSecretario?: boolean
}

export default function UserFormModal({
  usuario,
  onClose,
  onSave,
  isSecretario = false,
}: UserFormModalProps) {
  const [formData, setFormData] = useState<Usuario>({
    cc: '',
    nombre: '',
    apellido: '',
    correo_electronico: '',
    telefono: '',
    estado: 'activo',
    tipo_documento_id: 1,
    comuna_id: null,
    barrio_id: null,
    roles: [],
  })

  const [tiposDocumento, setTiposDocumento] = useState<TipoDocumento[]>([])
  const [comunas, setComunas] = useState<Comuna[]>([])
  const [barrios, setBarrios] = useState<Barrio[]>([])
  const [barriosFiltrados, setBarriosFiltrados] = useState<Barrio[]>([])
  const [roles, setRoles] = useState<Array<{ id: number; nombre: string }>>([])
  const [selectedRoles, setSelectedRoles] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchTiposDocumento()
    fetchComunas()
    fetchBarrios()
    fetchRoles()
    if (usuario) {
      setFormData(usuario)
      setSelectedRoles(usuario.roles?.map((r) => r.id) || [])
      // Filtrar barrios si ya tiene comuna
      if (usuario.comuna_id) {
        filterBarrios(usuario.comuna_id)
      }
    }
  }, [usuario])

  const fetchTiposDocumento = async () => {
    try {
      const { data, error } = await supabase
        .from('komerizo_tipo_documento')
        .select('id, nombre, abreviatura')
        .order('nombre')

      if (error) throw error
      setTiposDocumento(data || [])
    } catch (error) {
      console.error('Error al cargar tipos de documento:', error)
    }
  }

  const fetchComunas = async () => {
    try {
      const { data, error } = await supabase
        .from('komerizo_comunas')
        .select('id, nombre')
        .order('nombre')

      if (error) throw error
      setComunas(data || [])
    } catch (error) {
      console.error('Error al cargar comunas:', error)
    }
  }

  const fetchBarrios = async () => {
    try {
      const { data, error } = await supabase
        .from('komerizo_barrios')
        .select('id, nombre, comuna_id')
        .order('nombre')

      if (error) throw error
      setBarrios(data || [])
    } catch (error) {
      console.error('Error al cargar barrios:', error)
    }
  }

  const filterBarrios = (comunaId: number) => {
    const filtered = barrios.filter((b) => b.comuna_id === comunaId)
    setBarriosFiltrados(filtered)
  }

  const handleComunaChange = (comunaId: number) => {
    setFormData({ ...formData, comuna_id: comunaId, barrio_id: null })
    filterBarrios(comunaId)
  }

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('komerizo_roles')
        .select('id, nombre')
        .order('nombre')

      if (error) throw error
      setRoles(data || [])
    } catch (error) {
      console.error('Error al cargar roles:', error)
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.cc.trim()) {
      newErrors.cc = 'CC es requerida'
    }
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'Nombre es requerido'
    }
    if (!formData.apellido.trim()) {
      newErrors.apellido = 'Apellido es requerido'
    }

    // Si es nuevo usuario, validar contraseña
    if (!usuario && !formData.contrasena) {
      newErrors.contrasena = 'Contraseña es requerida'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setLoading(true)

    try {
      if (usuario) {
        // Editar usuario
        const { error } = await supabase
          .from('komerizo_usuarios')
          .update({
            cc: formData.cc,
            nombre: formData.nombre,
            apellido: formData.apellido,
            correo_electronico: formData.correo_electronico || null,
            telefono: formData.telefono || null,
            estado: formData.estado,
            tipo_documento_id: formData.tipo_documento_id,
            comuna_id: formData.comuna_id || null,
            barrio_id: formData.barrio_id || null,
            contrasena: formData.contrasena || undefined,
          })
          .eq('id', usuario.id)

        if (error) throw error

        // Actualizar roles
        if (usuario.id) {
          // Eliminar roles actuales
          await supabase
            .from('komerizo_usuario_roles')
            .delete()
            .eq('usuario_id', usuario.id)

          // Agregar nuevos roles
          if (selectedRoles.length > 0) {
            const rolesToInsert = selectedRoles.map((rolId) => ({
              usuario_id: usuario.id,
              rol_id: rolId,
            }))

            await supabase
              .from('komerizo_usuario_roles')
              .insert(rolesToInsert)
          }
        }
      } else {
        // Crear nuevo usuario
        const { data: nuevoUsuario, error } = await supabase
          .from('komerizo_usuarios')
          .insert({
            cc: formData.cc,
            tipo_documento_id: formData.tipo_documento_id,
            nombre: formData.nombre,
            apellido: formData.apellido,
            correo_electronico: formData.correo_electronico || null,
            telefono: formData.telefono || null,
            estado: formData.estado,
            comuna_id: formData.comuna_id || null,
            barrio_id: formData.barrio_id || null,
            contrasena: formData.contrasena,
          })
          .select()

        if (error) throw error

        // Asignar roles
        if (nuevoUsuario && nuevoUsuario[0] && selectedRoles.length > 0) {
          const rolesToInsert = selectedRoles.map((rolId) => ({
            usuario_id: nuevoUsuario[0].id,
            rol_id: rolId,
          }))

          await supabase
            .from('komerizo_usuario_roles')
            .insert(rolesToInsert)
        }
      }

      onSave()
    } catch (error: any) {
      console.error('Error al guardar usuario:', error)
      alert(error.message || 'Error al guardar usuario')
    } finally {
      setLoading(false)
    }
  }

  const handleRoleToggle = (roleId: number) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{usuario ? 'Editar Usuario' : 'Crear Nuevo Usuario'}</h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="user-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="tipoDocumento">Tipo de Documento *</label>
              <select
                id="tipoDocumento"
                value={formData.tipo_documento_id || 1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    tipo_documento_id: parseInt(e.target.value),
                  })
                }
              >
                <option value="">Selecciona un tipo...</option>
                {tiposDocumento.map((tipo) => (
                  <option key={tipo.id} value={tipo.id}>
                    {tipo.nombre} ({tipo.abreviatura})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="cc">CC *</label>
              <input
                id="cc"
                type="text"
                value={formData.cc}
                onChange={(e) =>
                  setFormData({ ...formData, cc: e.target.value })
                }
                placeholder="Ej: 123456789"
                disabled={!!usuario}
              />
              {errors.cc && <span className="error">{errors.cc}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nombre">Nombre *</label>
              <input
                id="nombre"
                type="text"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                placeholder="Ej: Juan"
              />
              {errors.nombre && <span className="error">{errors.nombre}</span>}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="apellido">Apellido *</label>
              <input
                id="apellido"
                type="text"
                value={formData.apellido}
                onChange={(e) =>
                  setFormData({ ...formData, apellido: e.target.value })
                }
                placeholder="Ej: Pérez"
              />
              {errors.apellido && (
                <span className="error">{errors.apellido}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="correo">Correo Electrónico</label>
              <input
                id="correo"
                type="email"
                value={formData.correo_electronico || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    correo_electronico: e.target.value,
                  })
                }
                placeholder="Ej: juan@email.com"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="telefono">Teléfono</label>
              <input
                id="telefono"
                type="tel"
                value={formData.telefono || ''}
                onChange={(e) =>
                  setFormData({ ...formData, telefono: e.target.value })
                }
                placeholder="Ej: 3001234567"
              />
            </div>

            <div className="form-group">
              <label htmlFor="estado">Estado *</label>
              <select
                id="estado"
                value={formData.estado}
                onChange={(e) =>
                  setFormData({ ...formData, estado: e.target.value })
                }
              >
                <option value="activo">Activo</option>
                <option value="inactivo">Inactivo</option>
                <option value="suspendido">Suspendido</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="comuna">Comuna</label>
              <select
                id="comuna"
                value={formData.comuna_id || ''}
                onChange={(e) =>
                  handleComunaChange(parseInt(e.target.value) || 0)
                }
              >
                <option value="">Selecciona una comuna...</option>
                {comunas.map((comuna) => (
                  <option key={comuna.id} value={comuna.id}>
                    {comuna.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="barrio">Barrio</label>
              <select
                id="barrio"
                value={formData.barrio_id || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    barrio_id: parseInt(e.target.value) || null,
                  })
                }
                disabled={!formData.comuna_id}
              >
                <option value="">
                  {formData.comuna_id
                    ? 'Selecciona un barrio...'
                    : 'Primero selecciona una comuna'}
                </option>
                {barriosFiltrados.map((barrio) => (
                  <option key={barrio.id} value={barrio.id}>
                    {barrio.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!usuario && (
            <div className="form-group">
              <label htmlFor="contrasena">Contraseña *</label>
              <input
                id="contrasena"
                type="password"
                value={formData.contrasena || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    contrasena: e.target.value,
                  })
                }
                placeholder="Contraseña"
                minLength={6}
              />
              {errors.contrasena && (
                <span className="error">{errors.contrasena}</span>
              )}
            </div>
          )}

          <div className="form-group">
            <label>Roles</label>
            <div className="roles-checkboxes">
              {roles
                .filter((role) => {
                  // Si es Secretario, filtrar roles que puede asignar
                  if (isSecretario) {
                    return role.nombre !== 'Administrador' && role.nombre !== 'Secretario'
                  }
                  return true
                })
                .map((role) => (
                  <label key={role.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.id)}
                      onChange={() => handleRoleToggle(role.id)}
                    />
                    <span>{role.nombre}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading
                ? 'Guardando...'
                : usuario
                  ? 'Actualizar Usuario'
                  : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
