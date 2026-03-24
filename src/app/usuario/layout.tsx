'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import UsuarioSidebar from '@/components/UsuarioSidebar'
import './usuario.css'

export default function UsuarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      // Verificar si el usuario existe
      if (!user) {
        router.push('/login')
        return
      }

      // El usuario debe estar autenticado, pero no ser Administrador o Secretario
      const esAdminOSecretario = user.roles?.some(
        (rol: any) => rol.nombre === 'Administrador' || rol.nombre === 'Secretario'
      )

      if (esAdminOSecretario) {
        // Si es admin o secretario, redirigir a su respectivo dashboard
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="usuario-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="usuario-layout">
      {user && <UsuarioSidebar user={user} />}
      <main className="usuario-main">{children}</main>
    </div>
  )
}
