'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import UsuarioSidebar from '@/components/UsuarioSidebar'
import './usuario.css'

export default function UsuarioLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (!loading) {
      console.log('👤 [usuario/layout] useEffect: checking user:', user?.email, 'roles:', user?.roles?.map(r => r.nombre))
      // Verificar si el usuario existe
      if (!user) {
        console.log('👤 [usuario/layout] No user, redirecting to login')
        router.push('/login')
        return
      }

      // El usuario DEBE tener el rol "Usuario" para acceder a esta sección
      const tieneRolUsuario = user.roles?.some(
        (rol: any) => rol.nombre === 'Usuario'
      )

      console.log('👤 [usuario/layout] tieneRolUsuario:', tieneRolUsuario)
      if (!tieneRolUsuario) {
        // Si NO tiene rol Usuario, redirigir a home para que se redirija según su rol principal
        console.log('👤 [usuario/layout] User does not have Usuario role, redirecting to /')
        router.push('/')
        return
      }

      console.log('👤 [usuario/layout] User authorized as Usuario')
      setIsAuthorized(true)
    }
  }, [user, loading, router])

  if (loading || !isAuthorized) {
    return (
      <div className="usuario-loading">
        <p>Cargando...</p>
      </div>
    )
  }

  return (
    <div className="usuario-layout">
      {user && <UsuarioSidebar user={user} />}
      <main className="usuario-main">{children}</main>
    </div>
  )
}
