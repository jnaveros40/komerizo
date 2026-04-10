'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import PresidenteSidebar from '@/components/PresidenteSidebar'
import Footer from '@/components/Footer'
import './presidente.css'

export default function PresidenteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('👑 [presidente/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('👑 [presidente/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Presidente" para acceder a esta sección
      const tieneRolPresidente = user.roles?.some(
        (rol: any) => rol.nombre === 'Presidente'
      )

      console.log('👑 [presidente/layout] tieneRolPresidente:', tieneRolPresidente)
      if (!tieneRolPresidente) {
        // Si NO tiene rol Presidente, redirigir a home para que se redirija según su rol principal
        console.log('👑 [presidente/layout] User does not have Presidente role, redirecting to /')
        router.push('/')
        return
      }

      console.log('👑 [presidente/layout] User authorized as Presidente')
      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="presidente-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="presidente-layout">
      <PresidenteSidebar />
      <main className="presidente-main">
        {children}
      </main>
      <Footer />
    </div>
  )
}
