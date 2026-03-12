import './Home.css'
import Footer from '../components/Footer'
import InstallPWA from '../components/InstallPWA'

const Home = () => {
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
