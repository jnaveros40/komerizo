'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import SecretarioSidebar from '@/components/SecretarioSidebar'
import './secretario.css'

export default function SecretarioLayout({
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

      // Verificar si tiene rol de Secretario
      const esSecretario = user.roles?.some(
        (rol: any) => rol.nombre === 'Secretario'
      )

      if (!esSecretario) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="secretario-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="secretario-layout">
      {user && <SecretarioSidebar user={user} />}
      <main className="secretario-main">
        <div className="secretario-content">{children}</div>
      </main>
    </div>
  )
}
