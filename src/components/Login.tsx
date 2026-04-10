'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import Footer from './Footer'
import './Login.css'

export default function Login() {
  const [identifier, setIdentifier] = useState('') // CC o correo
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
    setError('')

    try {
      // Buscar usuario por CC o correo
      let query = supabase
        .from('komerizo_usuarios')
        .select('*')

      // Determinar si es CC o correo
      if (identifier.includes('@')) {
        query = query.eq('correo_electronico', identifier)
      } else {
        query = query.eq('cc', identifier)
      }

      const { data: usuarios, error: fetchError } = await query

      if (fetchError) throw fetchError
      if (!usuarios || usuarios.length === 0) {
        setError('CC o correo no encontrado')
        setLoading(false)
        return
      }

      const usuario = usuarios[0]

      // Obtener las relaciones usuario-rol
      const { data: usuarioRolesData, error: relationError } = await supabase
        .from('komerizo_usuario_roles')
        .select('rol_id')
        .eq('usuario_id', usuario.id)

      console.log('usuarioRolesData:', usuarioRolesData)
      console.log('relationError:', relationError)

      if (relationError) {
        console.error('Error al obtener relaciones:', relationError)
      }

      // Obtener los IDs de roles
      const roleIds = usuarioRolesData?.map((rel: any) => rel.rol_id) || []
      console.log('roleIds extraídos:', roleIds)

      // Obtener información de los roles
      let usuarioRoles: Array<{ id: number; nombre: string }> = []
      if (roleIds.length > 0) {
        const { data: rolesData, error: rolesError } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .in('id', roleIds)

        console.log('rolesData:', rolesData)
        console.log('rolesError:', rolesError)

        if (rolesError) {
          console.error('Error al obtener roles:', rolesError)
        } else {
          usuarioRoles = rolesData || []
        }
      } else {
        console.log('No hay roleIds para buscar')
      }

      console.log('Roles obtenidos de la BD:', usuarioRoles)

      // Verificar contraseña (nota: en producción usar hash bcrypt o similar)
      if (usuario.contrasena !== password) {
        setError('Contraseña incorrecta')
        setLoading(false)
        return
      }

      // Verificar estado
      if (usuario.estado !== 'activo') {
        setError(`Usuario ${usuario.estado}`)
        setLoading(false)
        return
      }

      // Guardar sesión en localStorage
      const userForStorage = {
        id: usuario.id,
        cc: usuario.cc,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        correo_electronico: usuario.correo_electronico,
        telefono: usuario.telefono,
        direccion: usuario.direccion,
        jac: usuario.jac,
        firma: usuario.firma,
        estado: usuario.estado,
        comuna_id: usuario.comuna_id,
        barrio_id: usuario.barrio_id,
        roles: usuarioRoles,
      }

      console.log('Usuario para storage:', userForStorage)
      console.log('Roles del usuario:', userForStorage.roles)

      localStorage.setItem('komerizo_user', JSON.stringify(userForStorage))
      setMessage('¡Inicio de sesión exitoso!')

      // Determinar URL de redirección según el rol
      const redirectUrl = getRedirectUrlByRole(userForStorage.roles)
      console.log('URL de redirección calculada:', redirectUrl)

      // Redirigir después de 500ms
      setTimeout(() => {
        console.log('Redirigiendo a:', redirectUrl)
        window.location.href = redirectUrl
      }, 500)
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error)
      setError(error.message || 'Ocurrió un error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">🔐 Komerizo</h1>
        <p className="login-subtitle">Plataforma de Gestión de Comunales</p>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="identifier">📧 CC o Correo Electrónico</label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="1234567890 o tu@email.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">🔒 Contraseña</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
              minLength={6}
            />
          </div>

          {error && <div className="message error">{error}</div>}
          {message && <div className="message success">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="login-button"
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="login-footer">
          ¿No tienes cuenta? Contacta al administrador de la JAC
        </p>
      </div>
      <Footer />
    </div>
  )
}
