'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import UserFormModal from '@/components/UserFormModal'
import './usuarios.css'

type Usuario = {
  id: number
  cc: string
  nombre: string
  apellido: string
  correo_electronico?: string
  telefono?: string
  contraseña?: string
  comuna_id?: number
  barrio_id?: number
  estado: string
  comuna_nombre?: string
  barrio_nombre?: string
  roles?: Array<{ id: number; nombre: string }>
}

export default function SecretarioUsuariosPage() {
  const { user: authUser } = useAuth()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<Usuario | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('todos')
  const [comunaName, setComunaName] = useState('')
  const [barrioName, setBarrioName] = useState('')
  const [visiblePasswords, setVisiblePasswords] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchComunaBarrio()
  }, [authUser])

  const fetchComunaBarrio = async () => {
    if (!authUser?.comuna_id || !authUser?.barrio_id) return

    try {
      const { data: comunaData } = await supabase
        .from('komerizo_comunas')
        .select('nombre')
        .eq('id', authUser.comuna_id)
        .single()

      const { data: barrioData } = await supabase
        .from('komerizo_barrios')
        .select('nombre')
        .eq('id', authUser.barrio_id)
        .single()

      setComunaName(comunaData?.nombre || '')
      setBarrioName(barrioData?.nombre || '')
    } catch (error) {
      console.error('Error al cargar comuna y barrio:', error)
    }
  }

  const fetchUsuarios = async () => {
    try {
      setLoading(true)
      if (!authUser?.comuna_id) return

      // Obtener solo usuarios de la misma comuna y barrio
      const { data, error } = await supabase
        .from('komerizo_usuarios')
        .select('*, komerizo_comunas(nombre), komerizo_barrios(nombre)')
        .eq('comuna_id', authUser.comuna_id)
        .eq('barrio_id', authUser.barrio_id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Obtener roles para cada usuario
      const usuariosConRoles = await Promise.all(
        (data || []).map(async (usuario) => {
          const { data: rolesData } = await supabase
            .from('komerizo_usuario_roles')
            .select('rol_id')
            .eq('usuario_id', usuario.id)

          const roleIds = rolesData?.map((rel: any) => rel.rol_id) || []
          let roles: any[] = []

          if (roleIds.length > 0) {
            const { data: rolesInfo } = await supabase
              .from('komerizo_roles')
              .select('id, nombre')
              .in('id', roleIds)

            roles = rolesInfo || []
          }

          return {
            ...usuario,
            roles,
            comuna_nombre: usuario.komerizo_comunas?.nombre || '-',
            barrio_nombre: usuario.komerizo_barrios?.nombre || '-'
          }
        })
      )

      setUsuarios(usuariosConRoles)
    } catch (error) {
      console.error('Error al cargar usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authUser?.comuna_id) {
      fetchUsuarios()
    }
  }, [authUser])

  const handleCreateUser = () => {
    setEditingUser(null)
    setShowModal(true)
  }

  const handleEditUser = (usuario: Usuario) => {
    setEditingUser(usuario)
    setShowModal(true)
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return
    }

    try {
      // Eliminar relaciones de roles primero
      await supabase
        .from('komerizo_usuario_roles')
        .delete()
        .eq('usuario_id', id)

      // Eliminar usuario
      const { error } = await supabase
        .from('komerizo_usuarios')
        .delete()
        .eq('id', id)

      if (error) throw error

      setUsuarios(usuarios.filter((u) => u.id !== id))
    } catch (error) {
      console.error('Error al eliminar usuario:', error)
      alert('Error al eliminar usuario')
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingUser(null)
  }

  const handleUserSaved = () => {
    handleModalClose()
    fetchUsuarios()
  }

  const togglePasswordVisibility = (usuarioId: number) => {
    const newVisiblePasswords = new Set(visiblePasswords)
    if (newVisiblePasswords.has(usuarioId)) {
      newVisiblePasswords.delete(usuarioId)
    } else {
      newVisiblePasswords.add(usuarioId)
    }
    setVisiblePasswords(newVisiblePasswords)
  }

  // Filtrar usuarios
  const filteredUsuarios = usuarios.filter((usuario) => {
    // Excluir usuarios con roles de Administrador o Secretario
    const hasProtectedRole = usuario.roles?.some((role) =>
      role.nombre === 'Administrador' || role.nombre === 'Secretario'
    )
    
    if (hasProtectedRole) return false

    const matchesSearch =
      usuario.cc.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      usuario.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (usuario.correo_electronico?.toLowerCase().includes(searchTerm.toLowerCase()) || false)

    const matchesStatus =
      filterStatus === 'todos' || usuario.estado === filterStatus

    return matchesSearch && matchesStatus
  })

  if (loading) {
    return (
      <div className="usuarios-container">
        <div className="loading">Cargando usuarios...</div>
      </div>
    )
  }

  return (
    <div className="usuarios-container">
      <div className="usuarios-header">
        <div>
          <h1>👥 Gestión de Usuarios</h1>
          <p className="header-subtitle">Total: {filteredUsuarios.length} usuarios en {barrioName}</p>
          {comunaName && barrioName && (
            <p className="location-info">📍 {comunaName} - {barrioName}</p>
          )}
        </div>
        <button className="btn-primary" onClick={handleCreateUser}>
          ➕ Crear Usuario
        </button>
      </div>

      <div className="usuarios-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Buscar por CC, nombre, apellido o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-status">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="todos">Todos</option>
            <option value="activo">Activo</option>
            <option value="inactivo">Inactivo</option>
            <option value="suspendido">Suspendido</option>
          </select>
        </div>
      </div>

      {filteredUsuarios.length === 0 ? (
        <div className="no-users">
          <p>📭 No se encontraron usuarios en esta zona</p>
        </div>
      ) : (
        <div className="usuarios-table-wrapper">
          <table className="usuarios-table">
            <thead>
              <tr>
                <th>CC</th>
                <th>Nombre</th>
                <th>Apellido</th>
                <th>Correo</th>
                <th>Teléfono</th>
                <th>Contraseña</th>
                <th>Comuna</th>
                <th>Barrio</th>
                <th>Roles</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="cc-cell">{usuario.cc}</td>
                  <td className="nombre-cell">{usuario.nombre}</td>
                  <td className="apellido-cell">{usuario.apellido}</td>
                  <td className="email-cell">
                    {usuario.correo_electronico || '-'}
                  </td>
                  <td className="phone-cell">{usuario.telefono || '-'}</td>
                  <td className="password-cell">
                    <div className="password-container">
                      <span className="password-value">
                        {visiblePasswords.has(usuario.id)
                          ? usuario.contraseña || '-'
                          : usuario.contraseña ? '••••••••' : '-'}
                      </span>
                      {usuario.contraseña && (
                        <button
                          className="btn-toggle-password"
                          onClick={() => togglePasswordVisibility(usuario.id)}
                          title={visiblePasswords.has(usuario.id) ? 'Ocultar' : 'Mostrar'}
                        >
                          {visiblePasswords.has(usuario.id) ? '👁️' : '👁️‍🗨️'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="comuna-cell">{usuario.comuna_nombre}</td>
                  <td className="barrio-cell">{usuario.barrio_nombre}</td>
                  <td className="roles-cell">
                    {usuario.roles && usuario.roles.length > 0 ? (
                      <div className="roles-badges">
                        {usuario.roles.map((role) => (
                          <span
                            key={role.id}
                            className={`role-badge ${role.nombre.toLowerCase().replace(/ /g, '-')}`}
                          >
                            {role.nombre}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="no-role">Sin rol</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`status-badge ${usuario.estado}`}
                    >
                      {usuario.estado}
                    </span>
                  </td>
                  <td className="actions-cell">
                    <button
                      className="btn-icon edit"
                      onClick={() => handleEditUser(usuario)}
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon delete"
                      onClick={() => handleDeleteUser(usuario.id)}
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <UserFormModal
          usuario={editingUser}
          onClose={handleModalClose}
          onSave={handleUserSaved}
          isSecretario={true}
          secretarioComuna={authUser?.comuna_id}
          secretarioBarrio={authUser?.barrio_id}
        />
      )}
    </div>
  )
}
