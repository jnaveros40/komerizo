'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import FiscalSidebar from '@/components/FiscalSidebar'
import Footer from '@/components/Footer'
import './fiscal.css'

export default function FiscalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('🔴 [fiscal/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('🔴 [fiscal/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Fiscal" para acceder a esta sección
      const tieneRolFiscal = user.roles?.some(
        (rol: any) => rol.nombre === 'Fiscal'
      )

      console.log('🔴 [fiscal/layout] tieneRolFiscal:', tieneRolFiscal)
      if (!tieneRolFiscal) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="fiscal-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="fiscal-layout">
        {user && <FiscalSidebar user={user} />}
        <main className="fiscal-main">
          <div className="fiscal-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
