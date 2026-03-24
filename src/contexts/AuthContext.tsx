'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type KomerizoUsuario = {
  id: number
  cc: string
  nombre: string
  apellido: string
  correo_electronico: string
  
  telefono: string | null
  direccion?: string
  jac?: string
  roles?: Array<{ id: number; nombre: string }>
  estado: string
  firma: boolean
  [key: string]: any
}

type AuthContextType = {
  user: KomerizoUsuario | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<KomerizoUsuario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar sesión guardada en localStorage
    const storedUser = localStorage.getItem('komerizo_user')
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (error) {
        localStorage.removeItem('komerizo_user')
      }
    }
    setLoading(false)
  }, [])

  const signOut = async () => {
    localStorage.removeItem('komerizo_user')
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
