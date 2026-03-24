'use client'

import '../usuario.css'

export default function UsuarioContactosPage() {
  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <h1>👥 Contactos JAC</h1>
        <p className="header-subtitle">Directiva de tu comunidad</p>
      </div>

      <div className="empty-state">
        <div className="empty-icon">📇</div>
        <h3>No hay contactos registrados</h3>
        <p>
          Los contactos de la directiva de tu JAC aparecerán aquí una vez se registren
          en el sistema. Mantén esta información disponible para comunicarte cuando lo necesites.
        </p>
      </div>
    </div>
  )
}
