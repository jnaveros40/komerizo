'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AdministradorSidebar from '@/components/AdministradorSidebar'
import './administrador.css'

export default function AdministradorLayout({
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

      // Verificar si tiene rol de Administrador
      const esAdministrador = user.roles?.some(
        (rol: any) => rol.nombre === 'Administrador'
      )

      if (!esAdministrador) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="administrador-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="administrador-layout">
      {user && <AdministradorSidebar user={user} />}
      <div className="administrador-content">
        {children}
      </div>
    </div>
  )
}
