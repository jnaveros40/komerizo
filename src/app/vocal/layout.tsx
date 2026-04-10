'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import VocalSidebar from '@/components/VocalSidebar'
import Footer from '@/components/Footer'
import './vocal.css'

export default function VocalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('🎤 [vocal/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('🎤 [vocal/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Vocal" para acceder a esta sección
      const tieneRolVocal = user.roles?.some(
        (rol: any) => rol.nombre === 'Vocal'
      )

      console.log('🎤 [vocal/layout] tieneRolVocal:', tieneRolVocal)
      if (!tieneRolVocal) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="vocal-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="vocal-layout">
        {user && <VocalSidebar user={user} />}
        <main className="vocal-main">
          <div className="vocal-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
