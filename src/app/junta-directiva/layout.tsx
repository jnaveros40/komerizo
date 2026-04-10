'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import JuntaDirectivaSidebar from '@/components/JuntaDirectivaSidebar'

export default function JuntaDirectivaLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      // Verificar que el usuario tiene el rol de Junta Directiva
      const hasRole = user.roles?.some((rol: any) => rol.nombre === 'Junta Directiva')
      if (!hasRole) {
        router.push('/usuario')
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen bg-gray-950">
        <div>Cargando...</div>
      </div>
    )
  }

  const hasRole = user?.roles?.some((rol: any) => rol.nombre === 'Junta Directiva')

  if (!hasRole) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-950">
      <JuntaDirectivaSidebar user={user} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
