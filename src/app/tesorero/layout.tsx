'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import TesoreroSidebar from '@/components/TesoreroSidebar'
import Footer from '@/components/Footer'
import './tesorero.css'

export default function TesoreroLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('💚 [tesorero/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('💚 [tesorero/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Tesorero" para acceder a esta sección
      const tieneRolTesorero = user.roles?.some(
        (rol: any) => rol.nombre === 'Tesorero'
      )

      console.log('💚 [tesorero/layout] tieneRolTesorero:', tieneRolTesorero)
      if (!tieneRolTesorero) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="tesorero-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="tesorero-layout">
        {user && <TesoreroSidebar user={user} />}
        <main className="tesorero-main">
          <div className="tesorero-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
