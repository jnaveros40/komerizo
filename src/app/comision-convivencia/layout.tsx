'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ComisionConvivenciaSidebar from '@/components/ComisionConvivenciaSidebar'
import Footer from '@/components/Footer'
import './comision-convivencia.css'

export default function ComisionConvivenciaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('🤝 [comision-convivencia/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('🤝 [comision-convivencia/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Comisión de Convivencia y Conciliación" para acceder a esta sección
      const tieneRolComision = user.roles?.some(
        (rol: any) => rol.nombre === 'Comisión de Convivencia y Conciliación'
      )

      console.log('🤝 [comision-convivencia/layout] tieneRolComision:', tieneRolComision)
      if (!tieneRolComision) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="comision-convivencia-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="comision-convivencia-layout">
        {user && <ComisionConvivenciaSidebar user={user} />}
        <main className="comision-convivencia-main">
          <div className="comision-convivencia-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
