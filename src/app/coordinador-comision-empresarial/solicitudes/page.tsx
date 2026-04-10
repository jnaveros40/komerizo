'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import '@/components/solicitudes.css'

interface Solicitud {
  id: string
  usuario_id: string
  usuario_nombre: string
  usuario_cc: string
  destinatario_rol_id: number
  destinatario_rol_nombre?: string
  estado: 'Pendiente' | 'Respondido'
  mensaje_solicitud: string
  mensaje_respuesta: string | null
  fecha_solicitud: string
  fecha_respuesta: string | null
}

export default function SolicitudesPage() {
  const { user } = useAuth()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todos' | 'asignados'>('todos')
  const [filtroEstado, setFiltroEstado] = useState<'Todos' | 'Pendiente' | 'Respondido'>('Todos')
  const [filtroResponsable, setFiltroResponsable] = useState<string>('todos')
  const [filtroCedula, setFiltroCedula] = useState<string>('')
  const [rolesDisponibles, setRolesDisponibles] = useState<Array<{id: number, nombre: string}>>([])
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [presidenteRoleId, setPresidenteRoleId] = useState<number | null>(null)
  const [userRoleIds, setUserRoleIds] = useState<number[]>([])

  useEffect(() => {
    if (user?.id) {
      loadRolesAndFetchSolicitudes()
    }
  }, [user, filtro, filtroEstado, filtroResponsable, filtroCedula])

  const loadRolesAndFetchSolicitudes = async () => {
    try {
      setLoading(true)

      // Get Presidente role ID dinámicamente
      const { data: rolesData } = await supabase
        .from('komerizo_roles')
        .select('id')
        .eq('nombre', 'Presidente')
        .single()

      const presidenteId = rolesData?.id || null
      setPresidenteRoleId(presidenteId)

      // Get all available roles for the dropdown
      const { data: allRolesData } = await supabase
        .from('komerizo_roles')
        .select('id, nombre')
        .order('nombre')

      setRolesDisponibles(allRolesData || [])

      // Get all roles for current user
      const { data: userRolesData } = await supabase
        .from('komerizo_usuario_roles')
        .select('rol_id')
        .eq('usuario_id', user!.id)

      const roleIds = userRolesData?.map(r => r.rol_id) || []
      setUserRoleIds(roleIds)

      // Fetch all solicitudes destinadas a ANY of the user's roles
      let query = supabase
        .from('komerizo_solicitud_informes')
        .select('*')

      if (filtro === 'asignados') {
        query = query.eq('estado', 'Pendiente')
      }

      const { data: solicitudesData, error } = await query

      if (error) throw error

      if (solicitudesData && solicitudesData.length > 0) {
        // Filter solicitudes that are for user's roles
        let filteredSolicitudes = solicitudesData.filter(sol =>
          roleIds.includes(sol.destinatario_rol_id)
        )

        // Enrich with usuario names, CC and role names
        const enrichedSolicitudes = await Promise.all(
          filteredSolicitudes.map(async (sol: any) => {
            const { data: userData } = await supabase
              .from('komerizo_usuarios')
              .select('nombre, cc')
              .eq('id', sol.usuario_id)
              .single()

            const { data: rolData } = await supabase
              .from('komerizo_roles')
              .select('nombre')
              .eq('id', sol.destinatario_rol_id)
              .single()

            return {
              ...sol,
              usuario_nombre: userData?.nombre || 'Usuario Desconocido',
              usuario_cc: userData?.cc || '',
              destinatario_rol_nombre: rolData?.nombre || 'Rol Desconocido'
            }
          })
        )

        // Apply additional filters
        let finalSolicitudes = enrichedSolicitudes

        // Filter by estado
        if (filtroEstado !== 'Todos') {
          finalSolicitudes = finalSolicitudes.filter(sol => sol.estado === filtroEstado)
        }

        // Filter by responsable (rol destinatario)
        if (filtroResponsable !== 'todos') {
          finalSolicitudes = finalSolicitudes.filter(
            sol => sol.destinatario_rol_id.toString() === filtroResponsable
          )
        }

        // Filter by cedula
        if (filtroCedula.trim() !== '') {
          finalSolicitudes = finalSolicitudes.filter(sol =>
            sol.usuario_cc.includes(filtroCedula.trim())
          )
        }

        setSolicitudes(finalSolicitudes)
      } else {
        setSolicitudes([])
      }
    } catch (error) {
      console.error('Error al cargar solicitudes:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSolicitudes = async () => {
    await loadRolesAndFetchSolicitudes()
  }

  const handleRespond = async () => {
    if (!respondingTo || !respuesta.trim()) {
      alert('Por favor ingresa una respuesta')
      return
    }

    try {
      setSubmitting(true)

      const { error } = await supabase
        .from('komerizo_solicitud_informes')
        .update({
          estado: 'Respondido',
          mensaje_respuesta: respuesta,
          fecha_respuesta: new Date().toISOString()
        })
        .eq('id', respondingTo)

      if (error) throw error

      // Reset form
      setRespuesta('')
      setRespondingTo(null)

      // Refresh data
      await fetchSolicitudes()
      alert('Respuesta enviada exitosamente')
    } catch (error) {
      console.error('Error al enviar respuesta:', error)
      alert('Error al enviar la respuesta')
    } finally {
      setSubmitting(false)
    }
  }

  const pendientesCount = solicitudes.filter(s => s.estado === 'Pendiente').length

  if (loading) {
    return <div className="solicitudes-loading"><p>Cargando solicitudes...</p></div>
  }

  return (
    <div className="solicitudes-container">
      <div className="solicitudes-header">
        <h1>📋 Solicitudes de Informes</h1>
        <p className="header-subtitle">Gestiona las solicitudes de información recibidas</p>
      </div>

      {/* Filtros */}
      <div className="filtro-selector">
        <div className="filtro-group">
          <label className="filtro-label">Estado:</label>
          <select
            className="filtro-select"
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
          >
            <option value="Todos">Todos</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Respondido">Respondido</option>
          </select>
        </div>

        <div className="filtro-group">
          <label className="filtro-label">Responsable:</label>
          <select
            className="filtro-select"
            value={filtroResponsable}
            onChange={(e) => setFiltroResponsable(e.target.value)}
          >
            <option value="todos">Todos los roles</option>
            {rolesDisponibles.map((rol) => (
              <option key={rol.id} value={rol.id.toString()}>
                {rol.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="filtro-group">
          <label className="filtro-label">Cédula:</label>
          <input
            type="text"
            className="filtro-input"
            placeholder="Buscar por cédula..."
            value={filtroCedula}
            onChange={(e) => setFiltroCedula(e.target.value)}
          />
        </div>

        <button
          className="filtro-btn-reset"
          onClick={() => {
            setFiltroEstado('Todos')
            setFiltroResponsable('todos')
            setFiltroCedula('')
          }}
        >
          Limpiar Filtros
        </button>
      </div>

      {/* Lista de solicitudes */}
      {solicitudes.length === 0 ? (
        <div className="no-solicitudes">
          <p>No hay solicitudes para mostrar</p>
        </div>
      ) : (
        <div className="solicitudes-list">
          {solicitudes.map((sol) => (
            <div key={sol.id} className="solicitud-card">
              <div className="solicitud-header">
                <div className="solicitud-info">
                  <h3>{sol.usuario_nombre}</h3>
                  <div className="solicitud-meta">
                    <p className="solicitud-date">{new Date(sol.fecha_solicitud).toLocaleDateString('es-CO')}</p>
                    <span className="solicitud-cc">CC: {sol.usuario_cc}</span>
                    <span className="solicitud-rol-badge">{sol.destinatario_rol_nombre}</span>
                  </div>
                </div>
                <div className={`estado-badge estado-${sol.estado.toLowerCase()}`}>
                  {sol.estado}
                </div>
              </div>

              <div className="solicitud-content">
                <p className="solicitud-message">
                  <strong>Solicitud:</strong> {sol.mensaje_solicitud}
                </p>
                {sol.mensaje_respuesta && (
                  <p className="solicitud-response">
                    <strong>Respuesta:</strong> {sol.mensaje_respuesta}
                  </p>
                )}
              </div>

              {/* Formulario de respuesta (solo para pendientes Y dirigidas al rol Presidente) */}
              {sol.estado === 'Pendiente' && sol.destinatario_rol_id === presidenteRoleId && (
                <div className="respuesta-section">
                  {respondingTo === sol.id ? (
                    <div className="respuesta-form">
                      <textarea
                        className="respuesta-textarea"
                        placeholder="Escribe tu respuesta aquí..."
                        value={respuesta}
                        onChange={(e) => setRespuesta(e.target.value)}
                        rows={4}
                      />
                      <div className="respuesta-actions">
                        <button
                          className="btn-enviar"
                          onClick={handleRespond}
                          disabled={submitting || !respuesta.trim()}
                        >
                          {submitting ? 'Enviando...' : 'Enviar Respuesta'}
                        </button>
                        <button
                          className="btn-cancelar"
                          onClick={() => {
                            setRespondingTo(null)
                            setRespuesta('')
                          }}
                          disabled={submitting}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn-responder"
                      onClick={() => setRespondingTo(sol.id)}
                    >
                      Responder
                    </button>
                  )}
                </div>
              )}

              {/* Mensaje indicativo cuando es solo visualización */}
              {sol.estado === 'Pendiente' && sol.destinatario_rol_id !== presidenteRoleId && (
                <div className="solicitud-view-only">
                  <p>👁️ Solo visualización - Esta solicitud es para {sol.destinatario_rol_nombre}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
