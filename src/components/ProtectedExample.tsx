'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Componente de ejemplo que muestra cómo usar la autenticación
 * Protege una ruta y muestra la información del usuario
 */
export default function ProtectedExample() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Redirigir a login si no hay usuario
    if (!loading && !user) {
      router.push('/login')
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Cargando...</p>
      </div>
    )
  }

  if (!user) {
    return null
  }

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Bienvenido, {user.nombre}!</h1>

      <div
        style={{
          backgroundColor: '#f0f0f0',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h2>Información de Usuario</h2>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
          }}
        >
          <tbody>
            <tr>
              <td style={{ fontWeight: 'bold', padding: '8px' }}>
                Nombre Completo:
              </td>
              <td style={{ padding: '8px' }}>
                {user.nombre} {user.apellido}
              </td>
            </tr>
            <tr style={{ backgroundColor: '#fff' }}>
              <td style={{ fontWeight: 'bold', padding: '8px' }}>CC:</td>
              <td style={{ padding: '8px' }}>{user.cc}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', padding: '8px' }}>Correo:</td>
              <td style={{ padding: '8px' }}>{user.correo_electronico}</td>
            </tr>
            <tr style={{ backgroundColor: '#fff' }}>
              <td style={{ fontWeight: 'bold', padding: '8px' }}>
                Teléfono:
              </td>
              <td style={{ padding: '8px' }}>{user.telefono || 'N/A'}</td>
            </tr>
            <tr>
              <td style={{ fontWeight: 'bold', padding: '8px' }}>JAC:</td>
              <td style={{ padding: '8px' }}>{user.jac || 'N/A'}</td>
            </tr>
            <tr style={{ backgroundColor: '#fff' }}>
              <td style={{ fontWeight: 'bold', padding: '8px' }}>Estado:</td>
              <td style={{ padding: '8px' }}>
                <span
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor:
                      user.estado === 'activo' ? '#4caf50' : '#f44336',
                    color: 'white',
                    fontSize: '12px',
                  }}
                >
                  {user.estado}
                </span>
              </td>
            </tr>
            {user.firma && (
              <tr>
                <td style={{ fontWeight: 'bold', padding: '8px' }}>Firma:</td>
                <td style={{ padding: '8px' }}>
                  ✅ Pertenece a la JAC
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {user.roles && user.roles.length > 0 && (
        <div
          style={{
            backgroundColor: '#e3f2fd',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px',
          }}
        >
          <h2>Roles</h2>
          <ul>
            {user.roles.map((rol: any) => (
              <li key={rol.id}>{rol.nombre}</li>
            ))}
          </ul>
        </div>
      )}

      <div
        style={{
          backgroundColor: '#fff3cd',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <p>
          <strong>Dirección:</strong> {user.direccion || 'No registrada'}
        </p>
        <p>
          <strong>Observaciones:</strong> {user.observaciones || 'Ninguna'}
        </p>
      </div>

      <button
        onClick={handleLogout}
        style={{
          padding: '10px 20px',
          backgroundColor: '#f44336',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '16px',
        }}
      >
        Cerrar Sesión
      </button>
    </div>
  )
}
