'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
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
        .select('*, komerizo_usuario_roles(*, komerizo_roles(*))')

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
        roles: usuario.komerizo_usuario_roles?.map((ur: any) => ({
          id: ur.komerizo_roles.id,
          nombre: ur.komerizo_roles.nombre,
        })) || [],
      }

      localStorage.setItem('komerizo_user', JSON.stringify(userForStorage))
      setMessage('¡Inicio de sesión exitoso!')

      // Redirigir después de 1 segundo
      setTimeout(() => {
        window.location.href = '/'
      }, 1000)
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
        <h1 className="login-title">Iniciar Sesión</h1>

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="identifier">CC o Correo Electrónico</label>
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
            <label htmlFor="password">Contraseña</label>
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
