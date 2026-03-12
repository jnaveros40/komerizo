'use client'

import './Home.css'
import Footer from '../components/Footer'
import InstallPWA from '../components/InstallPWA'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

const Home = () => {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
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

  const technologies = [
    { name: 'React 19', icon: '⚛️', color: '#61dafb' },
    { name: 'TypeScript', icon: '🔷', color: '#3178c6' },
    { name: 'Vite', icon: '⚡', color: '#646cff' },
    { name: 'Tailwind CSS', icon: '💨', color: '#06b6d4' },
    { name: 'Firebase', icon: '🔥', color: '#ffca28' },
    { name: 'Supabase', icon: '🗄️', color: '#3ecf8e' },
    { name: 'PWA', icon: '📱', color: '#5a0fc8' },
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
          <img src="/IngNavs.png" alt="Logo" style={{ width: '10%', height: '10%', objectFit: 'contain' }} />
        </div>
        <h1 className="hero-title">
          Esta es una plantilla
          <span className="gradient-text"> lista para usar</span>
        </h1>
        <p className="hero-subtitle">
          Comienza tu próximo proyecto con una base profesional que incluye
          las mejores tecnologías del momento
        </p>
        
        <div className="hero-buttons">
          <button className="btn-primary">
            Comenzar Proyecto
          </button>
          <button className="btn-secondary">
            Ver Documentación
          </button>
        </div>
      </div>

      {/* Technologies Grid */}
      <div className="technologies-section">
        <h2 className="section-title">🛠️ Tecnologías Incluidas</h2>
        <div className="tech-grid">
          {technologies.map((tech) => (
            <div key={tech.name} className="tech-card">
              <div className="tech-icon" style={{ color: tech.color }}>
                {tech.icon}
              </div>
              <h3 className="tech-name">{tech.name}</h3>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="features-section">
        <h2 className="section-title">✨ Características</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3 className="feature-title">Sistema de Colores</h3>
            <p className="feature-description">
              Paleta de colores centralizada y fácil de personalizar
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🌓</div>
            <h3 className="feature-title">Modo Oscuro</h3>
            <p className="feature-description">
              Soporte automático para tema claro y oscuro
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📦</div>
            <h3 className="feature-title">Componentes</h3>
            <p className="feature-description">
              Componentes reutilizables listos para usar
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3 className="feature-title">Autenticación</h3>
            <p className="feature-description">
              Firebase y Supabase preconfigurados
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">⚡</div>
            <h3 className="feature-title">Rápido</h3>
            <p className="feature-description">
              Optimizado con Vite para máxima velocidad
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">📱</div>
            <h3 className="feature-title">PWA Ready</h3>
            <p className="feature-description">
              Convertible a app instalable en dispositivos
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
