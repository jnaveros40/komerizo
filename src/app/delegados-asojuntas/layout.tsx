'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import DelegadosAsojuntasSidebar from '@/components/DelegadosAsojuntasSidebar'
import Footer from '@/components/Footer'
import './delegados-asojuntas.css'

export default function DelegadosAsojuntasLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('🌐 [delegados-asojuntas/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('🌐 [delegados-asojuntas/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Delegados a Asojuntas" para acceder a esta sección
      const tieneRolDelegado = user.roles?.some(
        (rol: any) => rol.nombre === 'Delegados a Asojuntas'
      )

      console.log('🌐 [delegados-asojuntas/layout] tieneRolDelegado:', tieneRolDelegado)
      if (!tieneRolDelegado) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="delegados-asojuntas-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="delegados-asojuntas-layout">
        {user && <DelegadosAsojuntasSidebar user={user} />}
        <main className="delegados-asojuntas-main">
          <div className="delegados-asojuntas-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
