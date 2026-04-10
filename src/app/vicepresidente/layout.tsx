'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import VicepresidenteSidebar from '@/components/VicepresidenteSidebar'
import Footer from '@/components/Footer'
import './vicepresidente.css'

export default function VicepresidenteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('🩵 [vicepresidente/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('🩵 [vicepresidente/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Vicepresidente" para acceder a esta sección
      const tieneRolVicepresidente = user.roles?.some(
        (rol: any) => rol.nombre === 'Vicepresidente'
      )

      console.log('🩵 [vicepresidente/layout] tieneRolVicepresidente:', tieneRolVicepresidente)
      if (!tieneRolVicepresidente) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="vicepresidente-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="vicepresidente-layout">
        {user && <VicepresidenteSidebar user={user} />}
        <main className="vicepresidente-main">
          <div className="vicepresidente-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
  
}
