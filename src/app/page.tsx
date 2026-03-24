'use client'

import './Home.css'
import Footer from '../components/Footer'
import InstallPWA from '../components/InstallPWA'
import { useAuth } from '@/contexts/AuthContext'
import { getRedirectUrlByRole } from '@/lib/roleRedirect'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const Home = () => {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login')
        return
      }

      // Si el usuario tiene un rol con dashboard específico, redirigirlo
      const redirectUrl = getRedirectUrlByRole(user.roles || [])
      if (redirectUrl !== '/') {
        router.push(redirectUrl)
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontSize: '1.5rem'
      }}>
        Cargando...
      </div>
    )
  }

  if (!user) {
    return null
  }

  const features = [
    { name: 'Ventas', icon: '💰', color: '#10b981' },
    { name: 'Inventario', icon: '📦', color: '#3b82f6' },
    { name: 'Clientes', icon: '👥', color: '#8b5cf6' },
    { name: 'Reportes', icon: '📊', color: '#f59e0b' },
    { name: 'Facturación', icon: '🧾', color: '#ef4444' },
    { name: 'Analytics', icon: '📈', color: '#06b6d4' },
  ]

  return (
    <div className="main-content">
      {/* Header con botón de cerrar sesión */}
      <div style={{ 
        position: 'absolute', 
        top: '1rem', 
        right: '1rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center'
      }}>
        <span style={{ fontSize: '0.875rem', color: '#666' }}>
          {user.email}
        </span>
        <button 
          onClick={signOut}
          style={{
            padding: '0.5rem 1rem',
            background: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '600'
          }}
        >
          Cerrar Sesión
        </button>
      </div>

      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-icon">
          <span style={{ fontSize: '5rem' }}>🛒</span>
        </div>
        <h1 className="hero-title">
          Bienvenido a
          <span className="gradient-text"> Komerizo</span>
        </h1>
        <p className="hero-subtitle">
          Sistema integral de gestión comercial que potencia tu negocio
          con herramientas modernas y análisis en tiempo real
        </p>
        
        <div className="hero-buttons">
          <button className="btn-primary">
            Iniciar Venta
          </button>
          <button className="btn-secondary">
            Ver Dashboard
          </button>
        </div>
      </div>

      {/* Features Grid */}
      <div className="technologies-section">
        <h2 className="section-title">🚀 Módulos Principales</h2>
        <div className="tech-grid">
          {features.map((feature) => (
            <div key={feature.name} className="tech-card">
              <div className="tech-icon" style={{ color: feature.color }}>
                {feature.icon}
              </div>
              <h3 className="tech-name">{feature.name}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="features-section">
        <h2 className="section-title">✨ Funcionalidades</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">💳</div>
            <h3 className="feature-title">Punto de Venta</h3>
            <p className="feature-description">
              Sistema POS rápido e intuitivo para procesar ventas
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📋</div>
            <h3 className="feature-title">Control de Stock</h3>
            <p className="feature-description">
              Gestión completa de inventario en tiempo real
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">👤</div>
            <h3 className="feature-title">CRM Integrado</h3>
            <p className="feature-description">
              Administra clientes y mejora relaciones comerciales
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3 className="feature-title">Seguridad</h3>
            <p className="feature-description">
              Autenticación robusta con Supabase
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Tiempo Real</h3>
            <p className="feature-description">
              Sincronización instantánea de datos
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3 className="feature-title">PWA</h3>
            <p className="feature-description">
              Usa la app en cualquier dispositivo
            </p>
          </div>
        </div>
      </div>
      <Footer />
      <InstallPWA />
    </div>
  )
}

export default Home
