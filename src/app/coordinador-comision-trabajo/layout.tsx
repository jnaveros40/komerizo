'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CoordinadoresComisionesSidebar from '@/components/CoordinadorComisionTrabajoSidebar'
import Footer from '@/components/Footer'
import './coordinadores-comisiones.css'

export default function CoordinadoresComisionesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('🏗️ [coordinadores-comisiones/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('🏗️ [coordinadores-comisiones/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Coordinadores de Comisiones de Trabajo" para acceder a esta sección
      const tieneRolCoordinador = user.roles?.some(
        (rol: any) => rol.nombre === 'Coordinadores de Comisiones de Trabajo'
      )

      console.log('🏗️ [coordinadores-comisiones/layout] tieneRolCoordinador:', tieneRolCoordinador)
      if (!tieneRolCoordinador) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="coordinadores-comisiones-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="coordinadores-comisiones-layout">
        {user && <CoordinadoresComisionesSidebar user={user} />}
        <main className="coordinadores-comisiones-main">
          <div className="coordinadores-comisiones-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
