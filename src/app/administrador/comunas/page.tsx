'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import './comunas.css'

type Comuna = {
  id: number
  nombre: string
  created_at?: string
}

type Barrio = {
  id: number
  nombre: string
  comuna_id: number
  created_at?: string
}

export default function AdministradorComunasPage() {
  const [comunas, setComunas] = useState<Comuna[]>([])
  const [barrios, setBarrios] = useState<Barrio[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedComunaId, setSelectedComunaId] = useState<number | null>(null)
  const [searchBarrio, setSearchBarrio] = useState('')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Obtener comunas
      const { data: comunasData, error: comunasError } = await supabase
        .from('komerizo_comunas')
        .select('*')
        .order('nombre')

      if (comunasError) throw comunasError
      setComunas(comunasData || [])

      // Obtener barrios
      const { data: barriosData, error: barriosError } = await supabase
        .from('komerizo_barrios')
        .select('*')
        .order('nombre')

      if (barriosError) throw barriosError
      setBarrios(barriosData || [])

      // Seleccionar la primera comuna por defecto
      if (comunasData && comunasData.length > 0) {
        setSelectedComunaId(comunasData[0].id)
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedComuna = comunas.find((c) => c.id === selectedComunaId)
  const barriosFiltrados = selectedComunaId
    ? barrios
        .filter((b) => b.comuna_id === selectedComunaId)
        .filter((b) =>
          b.nombre.toLowerCase().includes(searchBarrio.toLowerCase())
        )
    : []

  if (loading) {
    return (
      <div className="comunas-container">
        <div className="loading">Cargando comunas y barrios...</div>
      </div>
    )
  }

  return (
    <div className="comunas-container">
      <div className="comunas-header">
        <div>
          <h1>Gestión de Comunas y Barrios</h1>
          <p>Administra las comunas de Ibagué y sus barrios</p>
        </div>
      </div>

      <div className="comunas-layout">
        {/* Panel de Comunas */}
        <div className="comunas-panel">
          <h2>Comunas</h2>
          <div className="comunas-list">
            {comunas.map((comuna) => (
              <div
                key={comuna.id}
                className={`comuna-item ${
                  selectedComunaId === comuna.id ? 'active' : ''
                }`}
                onClick={() => {
                  setSelectedComunaId(comuna.id)
                  setSearchBarrio('')
                }}
              >
                <div className="comuna-name">{comuna.nombre}</div>
                <div className="comuna-count">
                  {barrios.filter((b) => b.comuna_id === comuna.id).length}{' '}
                  barrios
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Panel de Barrios */}
        <div className="barrios-panel">
          {selectedComuna ? (
            <>
              <div className="barrios-header">
                <div>
                  <h2>{selectedComuna.nombre}</h2>
                  <p>
                    Total: {barriosFiltrados.length} de{' '}
                    {barrios.filter((b) => b.comuna_id === selectedComunaId)
                      .length}{' '}
                    barrios
                  </p>
                </div>
              </div>

              <div className="barrios-search">
                <input
                  type="text"
                  placeholder="Buscar barrio..."
                  value={searchBarrio}
                  onChange={(e) => setSearchBarrio(e.target.value)}
                />
              </div>

              {barriosFiltrados.length === 0 ? (
                <div className="no-barrios">
                  <p>No hay barrios en esta comuna</p>
                </div>
              ) : (
                <div className="barrios-list">
                  {barriosFiltrados.map((barrio) => (
                    <div key={barrio.id} className="barrio-item">
                      <div className="barrio-info">
                        <h3>{barrio.nombre}</h3>
                        <p className="barrio-comuna">{selectedComuna.nombre}</p>
                      </div>
                      <div className="barrio-actions">
                        <button className="btn-icon edit" title="Editar">
                          ✏️
                        </button>
                        <button className="btn-icon delete" title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="no-selection">
              <p>Selecciona una comuna</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
