'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import CoordinadorComisionEmpresarialSidebar from '@/components/CoordinadorComisionEmpresarialSidebar'
import Footer from '@/components/Footer'
import './coordinador-comision-empresarial.css'

export default function CoordinadorComisionEmpresarialLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('💼 [coordinador-comision-empresarial/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('💼 [coordinador-comision-empresarial/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Coordinador Comisión Empresarial" para acceder a esta sección
      const tieneRolCoordinador = user.roles?.some(
        (rol: any) => rol.nombre === 'Coordinador Comisión Empresarial'
      )

      console.log('💼 [coordinador-comision-empresarial/layout] tieneRolCoordinador:', tieneRolCoordinador)
      if (!tieneRolCoordinador) {
        router.push('/')
        return
      }

      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="coordinador-comision-empresarial-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <div className="coordinador-comision-empresarial-layout">
        {user && <CoordinadorComisionEmpresarialSidebar user={user} />}
        <main className="coordinador-comision-empresarial-main">
          <div className="coordinador-comision-empresarial-content">{children}</div>
        </main>
      </div>
      <Footer />
    </div>
  )
}
