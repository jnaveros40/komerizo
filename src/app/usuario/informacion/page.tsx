'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import '../usuario.css'

export default function UsuarioInformacionPage() {
  const { user } = useAuth()
  const [comunaName, setComunaName] = useState('')
  const [barrioName, setBarrioName] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState('')
  const [usuarioData, setUsuarioData] = useState<any>(null)
  const [roles, setRoles] = useState<any[]>([])

  useEffect(() => {
    fetchUserData()
  }, [user])

  const fetchUserData = async () => {
    if (!user?.id) return

    try {
      // Obtener datos frescos del usuario de Supabase
      const { data: userData, error: userError } = await supabase
        .from('komerizo_usuarios')
        .select('*')
        .eq('id', user.id)
        .single()

      if (userError) throw userError
      setUsuarioData(userData)

      // Obtener roles del usuario
      const { data: userRolesData, error: rolesError } = await supabase
        .from('komerizo_usuario_roles')
        .select('rol_id')
        .eq('usuario_id', user.id)

      if (!rolesError && userRolesData && userRolesData.length > 0) {
        const roleIds = userRolesData.map((ur: any) => ur.rol_id)
        const { data: rolesData } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .in('id', roleIds)
        setRoles(rolesData || [])
      }

      // Comuna
      if (userData?.comuna_id) {
        const { data: comunaData } = await supabase
          .from('komerizo_comunas')
          .select('nombre')
          .eq('id', userData.comuna_id)
          .single()
        setComunaName(comunaData?.nombre || '')
      }

      // Barrio
      if (userData?.barrio_id) {
        const { data: barrioData } = await supabase
          .from('komerizo_barrios')
          .select('nombre')
          .eq('id', userData.barrio_id)
          .single()
        setBarrioName(barrioData?.nombre || '')
      }

      // Tipo de documento
      if (userData?.tipo_documento_id) {
        const { data: tipoDocData } = await supabase
          .from('komerizo_tipo_documento')
          .select('nombre')
          .eq('id', userData.tipo_documento_id)
          .single()
        setTipoDocumento(tipoDocData?.nombre || '')
      }
    } catch (error) {
      console.error('Error al cargar datos:', error)
    }
  }

  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <h1>📋 Mi Información</h1>
        <p className="header-subtitle">Datos de tu perfil</p>
      </div>

      <div className="info-card">
        <div className="info-section">
          <h3>Datos Personales</h3>

          <div className="info-grid">
            <div className="info-item">
              <label>Tipo de Documento:</label>
              <p>{tipoDocumento || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Cédula:</label>
              <p>{usuarioData?.cc || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Nombre:</label>
              <p>{usuarioData?.nombre || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Apellido:</label>
              <p>{usuarioData?.apellido || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Correo Electrónico:</label>
              <p>{usuarioData?.correo_electronico || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Teléfono:</label>
              <p>{usuarioData?.telefono || 'N/A'}</p>
            </div>

            <div className="info-item">
              <label>Dirección:</label>
              <p>{usuarioData?.direccion || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="info-section">
          <h3>Ubicación</h3>

          <div className="info-grid">
            <div className="info-item">
              <label>Comuna:</label>
              <p>{comunaName || 'Cargando...'}</p>
            </div>

            <div className="info-item">
              <label>Barrio:</label>
              <p>{barrioName || 'Cargando...'}</p>
            </div>
          </div>
        </div>

        <div className="info-section">
          <h3>Roles Asignados</h3>
          <div className="roles-list">
            {roles && roles.length > 0 ? (
              roles.map((role: any) => (
                <div key={role.id} className="role-item">
                  <span className={`role-badge ${role.nombre.toLowerCase().replace(/ /g, '-')}`}>{role.nombre}</span>
                </div>
              ))
            ) : (
              <p>No hay roles asignados</p>
            )}
          </div>
        </div>
      </div>

      <div className="info-note">
        <p>
          Los datos mostrados aquí son los registrados en el sistema.
          Recuerda que puedes editar tu informacion personal en el menu Mi Perfil.
                    
        </p>
      </div>
    </div>
  )
}
