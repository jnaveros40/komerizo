'use client'

import '../usuario.css'

export default function UsuarioEventosPage() {
  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <h1>📅 Eventos</h1>
        <p className="header-subtitle">Próximas actividades en tu comunidad</p>
      </div>

      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <h3>No hay eventos registrados</h3>
        <p>
          Aquí aparecerán los próximos eventos, asambleas y actividades de tu JAC.
          Vuelve pronto para estar al tanto de todas las actividades.
        </p>
      </div>
    </div>
  )
}
