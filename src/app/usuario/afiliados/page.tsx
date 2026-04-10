'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import '../usuario.css'

type Afiliado = {
  id: number
  nombre: string
  apellido: string
  estado: string
  barrio_id: number
}

export default function AfiliadosPage() {
  const { user } = useAuth()
  const [afiliados, setAfiliados] = useState<Afiliado[]>([])
  const [loading, setLoading] = useState(true)
  const [barrioName, setBarrioName] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  useEffect(() => {
    fetchAfiliados()
  }, [user])

  const fetchAfiliados = async () => {
    if (!user?.barrio_id) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Obtener nombre del barrio
      const { data: barrioData } = await supabase
        .from('komerizo_barrios')
        .select('nombre')
        .eq('id', user.barrio_id)
        .single()

      if (barrioData) {
        setBarrioName(barrioData.nombre)
      }

      // Obtener todos los afiliados del mismo barrio
      const { data: afiliadosData, error } = await supabase
        .from('komerizo_usuarios')
        .select('id, nombre, apellido, estado, barrio_id')
        .eq('barrio_id', user.barrio_id)
        .order('nombre', { ascending: true })

      if (error) throw error

      setAfiliados(afiliadosData || [])
    } catch (error) {
      console.error('Error al cargar afiliados:', error)
    } finally {
      setLoading(false)
    }
  }

  const afiliadosFiltrados = afiliados.filter((afiliado) => {
    if (filtroEstado === 'todos') return true
    return afiliado.estado === filtroEstado
  })

  const obtenerColorEstado = (estado: string) => {
    switch (estado) {
      case 'activo':
        return 'status-activo'
      case 'inactivo':
        return 'status-inactivo'
      case 'suspendido':
        return 'status-suspendido'
      default:
        return ''
    }
  }

  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <h1>👥 Afiliados del Barrio</h1>
        <p className="header-subtitle">Miembros de {barrioName || 'tu barrio'}</p>
      </div>

      <div className="info-card">
        {/* Filtros */}
        <div className="filter-section">
          <div className="filter-group">
            <label htmlFor="filtro-estado">Filtrar por estado:</label>
            <select
              id="filtro-estado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="filter-select"
            >
              <option value="todos">Todos ({afiliados.length})</option>
              <option value="activo">
                Activos ({afiliados.filter((a) => a.estado === 'activo').length})
              </option>
              <option value="inactivo">
                Inactivos ({afiliados.filter((a) => a.estado === 'inactivo').length})
              </option>
              <option value="suspendido">
                Suspendidos ({afiliados.filter((a) => a.estado === 'suspendido').length})
              </option>
            </select>
          </div>
        </div>

        {/* Tabla de afiliados */}
        {loading ? (
          <div className="loading-state">
            <p>⏳ Cargando afiliados...</p>
          </div>
        ) : afiliadosFiltrados.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No hay afiliados</h3>
            <p>No se encontraron afiliados con el criterio seleccionado.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="afiliados-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {afiliadosFiltrados.map((afiliado) => (
                  <tr key={afiliado.id}>
                    <td className="nombre-cell">
                      <strong>{afiliado.nombre} {afiliado.apellido}</strong>
                    </td>
                    <td>
                      <span className={`status-badge ${obtenerColorEstado(afiliado.estado)}`}>
                        {afiliado.estado}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="info-note">
        <p>
          Aquí puedes ver todos los afiliados registrados en tu barrio. La información se muestra de forma limitada por protección de datos personales.
        </p>
      </div>
    </div>
  )
}
