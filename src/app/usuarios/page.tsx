'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import './usuarios.css'

export default function SecretarioUsuarios() {
  const [usuarios, setUsuarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from('komerizo_usuarios')
        .select('*, komerizo_usuario_roles(*, komerizo_roles(*))')
        .order('created_at', { ascending: false })

      if (error) throw error
      setUsuarios(data || [])
    } catch (error) {
      console.error('Error fetching usuarios:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsuarios = usuarios.filter((usuario) =>
    usuario.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.apellido.toLowerCase().includes(searchTerm.toLowerCase()) ||
    usuario.cc.includes(searchTerm) ||
    usuario.correo_electronico.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleEliminar = async (id: number) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este usuario?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('komerizo_usuarios')
        .delete()
        .eq('id', id)

      if (error) throw error
      setUsuarios(usuarios.filter((u) => u.id !== id))
      alert('Usuario eliminado correctamente')
    } catch (error: any) {
      console.error('Error eliminando usuario:', error)
      alert('Error al eliminar usuario: ' + error.message)
    }
  }

  return (
    <div className="usuarios-container">
      <div className="usuarios-header">
        <h1>Gestión de Usuarios</h1>
        <button className="btn-nuevo">+ Nuevo Usuario</button>
      </div>

      <div className="usuarios-search">
        <input
          type="text"
          placeholder="Buscar por nombre, CC, correo..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="loading">Cargando usuarios...</p>
      ) : filteredUsuarios.length === 0 ? (
        <p className="no-data">No hay usuarios que coincidan con la búsqueda</p>
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
                <th>Roles</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsuarios.map((usuario) => (
                <tr key={usuario.id}>
                  <td className="cc">{usuario.cc}</td>
                  <td>{usuario.nombre}</td>
                  <td>{usuario.apellido}</td>
                  <td className="email">{usuario.correo_electronico}</td>
                  <td>{usuario.telefono || '-'}</td>
                  <td>
                    <div className="roles-container">
                      {usuario.komerizo_usuario_roles?.map((ur: any) => (
                        <span key={ur.id} className="role-badge">
                          {ur.komerizo_roles.nombre}
                        </span>
                      )) || '-'}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`estado-badge estado-${usuario.estado}`}
                    >
                      {usuario.estado}
                    </span>
                  </td>
                  <td>
                    <div className="acciones">
                      <button
                        className="btn-editar"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-ver"
                        title="Ver detalles"
                      >
                        👁️
                      </button>
                      <button
                        className="btn-eliminar"
                        title="Eliminar"
                        onClick={() => handleEliminar(usuario.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="total-usuarios">
        Total: <strong>{filteredUsuarios.length}</strong> usuario(s)
      </p>
    </div>
  )
}
