'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import '@/components/reuniones.css';

interface Solicitud {
  id: number;
  usuario_id: number;
  usuario_nombre?: string;
  destinatario_rol_id: number;
  destinatario_rol_nombre?: string;
  destinatario_id: number;
  mensaje_solicitud: string;
  fecha_solicitud: string;
  mensaje_respuesta: string;
  fecha_respuesta: string | null;
  estado: string;
}

interface Rol {
  id: number;
  nombre: string;
  descripcion?: string;
}

// Mapeador de pathname a rol_id
const getRoleIdFromPathname = (pathname: string): number | null => {
  const pathMap: { [key: string]: number } = {
    'presidente': 17,
    'vicepresidente': 18,
    'tesorero': 2,
    'secretario': 3,
    'fiscal': 19,
  };

  for (const [path, roleId] of Object.entries(pathMap)) {
    if (pathname.includes(`/${path}/`)) {
      return roleId;
    }
  }
  return null;
};

export default function InformesPage() {
  const pathname = usePathname();
  const currentRoleId = getRoleIdFromPathname(pathname);

  const [tab, setTab] = useState<'recibidas' | 'enviadas'>('recibidas');
  const [solicitudesRecibidas, setSolicitudesRecibidas] = useState<Solicitud[]>([]);
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<Solicitud[]>([]);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);

  const [formData, setFormData] = useState({
    destinatario_rol_id: '',
    mensaje_solicitud: '',
  });

  const [selectedSolicitud, setSelectedSolicitud] = useState<Solicitud | null>(null);
  const [respuestaData, setRespuestaData] = useState('');

  // Cargar datos iniciales
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) {
        console.error('No hay usuario en sesión');
        return;
      }

      const user = JSON.parse(storedUser);
      setUsuario(user);

      // Cargar roles disponibles
      const { data: rolesData, error: rolesError } = await supabase
        .from('komerizo_roles')
        .select('id, nombre, descripcion')
        .order('nombre');

      if (rolesError) throw rolesError;
      setRoles(rolesData || []);

      // Cargar solicitudes recibidas (dirigidas a este rol)
      if (currentRoleId) {
        const { data: recibidas, error: recibidasError } = await supabase
          .from('komerizo_informes')
          .select('*')
          .eq('destinatario_rol_id', currentRoleId)
          .order('fecha_solicitud', { ascending: false });

        if (recibidasError) throw recibidasError;

        // Enriquecer con nombres de usuarios y roles
        const recibidasEnriquecidas = await Promise.all(
          (recibidas || []).map(async (sol) => {
            const usuarioNombre = sol.usuario_id ? await getUserName(sol.usuario_id) : 'Sistema';
            const rolNombre = rolesData?.find((r) => r.id === sol.destinatario_rol_id)?.nombre || `Rol ${sol.destinatario_rol_id}`;
            return {
              ...sol,
              usuario_nombre: usuarioNombre,
              destinatario_rol_nombre: rolNombre,
            };
          })
        );
        setSolicitudesRecibidas(recibidasEnriquecidas);
      }

      // Cargar solicitudes enviadas (del usuario actual)
      const { data: enviadas, error: enviadasError } = await supabase
        .from('komerizo_informes')
        .select('*')
        .eq('usuario_id', user.id)
        .order('fecha_solicitud', { ascending: false });

      if (enviadasError) throw enviadasError;

      // Enriquecer con nombres de roles
      const enviadasEnriquecidas = (enviadas || []).map((sol) => ({
        ...sol,
        usuario_nombre: user.nombre,
        destinatario_rol_nombre: rolesData?.find((r) => r.id === sol.destinatario_rol_id)?.nombre || `Rol ${sol.destinatario_rol_id}`,
      }));
      setSolicitudesEnviadas(enviadasEnriquecidas);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = async (userId: number): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('komerizo_usuarios')
        .select('nombre')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data?.nombre || 'Desconocido';
    } catch {
      return 'Desconocido';
    }
  };

  // Crear nueva solicitud
  const handleCrearSolicitud = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!usuario || !formData.destinatario_rol_id || !formData.mensaje_solicitud.trim()) {
      alert('Por favor completa todos los campos');
      return;
    }

    try {
      const { error } = await supabase.from('komerizo_informes').insert([
        {
          usuario_id: usuario.id,
          destinatario_rol_id: parseInt(formData.destinatario_rol_id),
          mensaje_solicitud: formData.mensaje_solicitud,
          estado: 'Pendiente',
        },
      ]);

      if (error) throw error;

      alert('Solicitud creada exitosamente');
      setFormData({ destinatario_rol_id: '', mensaje_solicitud: '' });
      setShowForm(false);
      await loadData();
    } catch (error) {
      console.error('Error creando solicitud:', error);
      alert('Error al crear la solicitud');
    }
  };

  // Responder solicitud recibida
  const handleResponder = async (solicitudId: number, respuesta: string, estado: string) => {
    if (!usuario || !respuesta.trim()) {
      alert('Por favor escribe una respuesta');
      return;
    }

    try {
      const { error } = await supabase
        .from('komerizo_informes')
        .update({
          mensaje_respuesta: respuesta,
          fecha_respuesta: new Date().toISOString(),
          estado: estado,
          destinatario_id: usuario.id,
        })
        .eq('id', solicitudId);

      if (error) throw error;

      alert('Solicitud respondida exitosamente');
      setSelectedSolicitud(null);
      setRespuestaData('');
      await loadData();
    } catch (error) {
      console.error('Error respondiendo solicitud:', error);
      alert('Error al responder la solicitud');
    }
  };

  // Componente de card de solicitud
  const renderSolicitudCard = (solicitud: Solicitud, isRecibida: boolean) => {
    return (
      <div key={solicitud.id} className="reunion-card">
        <div className="reunion-header">
          <div style={{ flex: 1 }}>
            <h3 className="reunion-titulo">
              {isRecibida ? `De: ${solicitud.usuario_nombre}` : `A: ${solicitud.destinatario_rol_nombre}`}
            </h3>
            <span className="reunion-tipo">{isRecibida ? 'Solicitud Recibida' : 'Solicitud Enviada'}</span>
          </div>
          <span className={`estado-badge ${solicitud.estado === 'Pendiente' ? 'pendiente' : 'confirmada'}`}>
            {solicitud.estado.toUpperCase()}
          </span>
        </div>

        <div className="reunion-meta">
          <div className="meta-item">
            <span className="meta-icon">📅</span>
            {new Date(solicitud.fecha_solicitud).toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div className="meta-item">
            <span className="meta-icon">🕐</span>
            {new Date(solicitud.fecha_solicitud).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ color: '#a1aec6', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📝 Solicitud:</div>
          <div className="reunion-descripcion">{solicitud.mensaje_solicitud}</div>
        </div>

        {solicitud.estado !== 'Pendiente' && (
          <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #3a4a5f' }}>
            <div style={{ color: '#a1aec6', fontSize: '0.85rem', marginBottom: '0.5rem' }}>💬 Respuesta:</div>
            <div className="reunion-descripcion">{solicitud.mensaje_respuesta}</div>
            {solicitud.fecha_respuesta && (
              <div className="meta-item" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ color: '#6c7a8f' }}>
                  Respondido el {new Date(solicitud.fecha_respuesta).toLocaleDateString('es-ES')}
                </span>
              </div>
            )}
          </div>
        )}

        {isRecibida && solicitud.estado === 'Pendiente' && (
          <div className="reunion-acciones">
            <button className="btn-reunion btn-editar" onClick={() => setSelectedSolicitud(solicitud)}>
              ✉️ Responder
            </button>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="reuniones-container">
        <div className="reuniones-loading">
          <p>Cargando informes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reuniones-container">
      <div className="reuniones-header">
        <div>
          <h1>📄 Informes</h1>
          <p className="header-subtitle">Solicita y responde solicitudes de informes</p>
        </div>
        <button className="btn-nueva-reunion" onClick={() => setShowForm(true)}>
          ➕ Solicitar Informe
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #3a4a5f' }}>
        <button
          onClick={() => setTab('recibidas')}
          style={{
            padding: '0.75rem 1.5rem',
            background: tab === 'recibidas' ? '#6c5ce7' : 'transparent',
            color: tab === 'recibidas' ? '#fff' : '#a1aec6',
            border: 'none',
            borderBottom: tab === 'recibidas' ? '2px solid #6c5ce7' : 'transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          📥 Recibidas ({solicitudesRecibidas.length})
        </button>
        <button
          onClick={() => setTab('enviadas')}
          style={{
            padding: '0.75rem 1.5rem',
            background: tab === 'enviadas' ? '#6c5ce7' : 'transparent',
            color: tab === 'enviadas' ? '#fff' : '#a1aec6',
            border: 'none',
            borderBottom: tab === 'enviadas' ? '2px solid #6c5ce7' : 'transparent',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          📤 Enviadas ({solicitudesEnviadas.length})
        </button>
      </div>

      {/* Formulario crear solicitud */}
      {showForm && (
        <div style={{
          background: '#1e2a3a',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #3a4a5f',
        }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Nueva Solicitud de Informe</h3>
          <form onSubmit={handleCrearSolicitud}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>
                Solicitar a (Rol):
              </label>
              <select
                name="destinatario_rol_id"
                value={formData.destinatario_rol_id}
                onChange={(e) => setFormData({ ...formData, destinatario_rol_id: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                }}
              >
                <option value="">Selecciona un rol</option>
                {roles.map((rol) => (
                  <option key={rol.id} value={rol.id}>
                    {rol.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>
                Mensaje de Solicitud:
              </label>
              <textarea
                name="mensaje_solicitud"
                value={formData.mensaje_solicitud}
                onChange={(e) => setFormData({ ...formData, mensaje_solicitud: e.target.value })}
                placeholder="Describe el informe que necesitas..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                className="btn-reunion btn-editar"
                style={{ flex: 1 }}
              >
                Enviar Solicitud
              </button>
              <button
                type="button"
                className="btn-reunion btn-cancelar-reunion"
                onClick={() => setShowForm(false)}
                style={{ flex: 1 }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal de respuesta */}
      {selectedSolicitud && (
        <div style={{
          background: '#1e2a3a',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #3a4a5f',
        }}>
          <h3 style={{ marginBottom: '1.5rem' }}>Responder Solicitud de {selectedSolicitud.usuario_nombre}</h3>
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#0f1419', borderRadius: '4px' }}>
            <div style={{ color: '#a1aec6', fontSize: '0.85rem', marginBottom: '0.5rem' }}>📝 Solicitud:</div>
            <p>{selectedSolicitud.mensaje_solicitud}</p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>
              Tu Respuesta:
            </label>
            <textarea
              value={respuestaData}
              onChange={(e) => setRespuestaData(e.target.value)}
              placeholder="Escribe tu respuesta al informe solicitado..."
              style={{
                width: '100%',
                minHeight: '150px',
                padding: '0.75rem',
                background: '#0f1419',
                color: '#fff',
                border: '1px solid #3a4a5f',
                borderRadius: '4px',
                fontFamily: 'inherit',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              className="btn-reunion btn-editar"
              onClick={() => handleResponder(selectedSolicitud.id, respuestaData, 'Respondido')}
              style={{ flex: 1 }}
            >
              ✅ Responder
            </button>
            <button
              className="btn-reunion btn-cancelar-reunion"
              onClick={() => {
                setSelectedSolicitud(null);
                setRespuestaData('');
              }}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Contenido tab */}
      <div className="reuniones-grid">
        {tab === 'recibidas' ? (
          solicitudesRecibidas.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📥</div>
              <h3>No hay solicitudes recibidas</h3>
              <p>No hay solicitudes de informes que responder en este momento.</p>
            </div>
          ) : (
            solicitudesRecibidas.map((sol) => renderSolicitudCard(sol, true))
          )
        ) : solicitudesEnviadas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📤</div>
            <h3>No has enviado solicitudes</h3>
            <p>Haz clic en "Solicitar Informe" para enviar tu primera solicitud.</p>
          </div>
        ) : (
          solicitudesEnviadas.map((sol) => renderSolicitudCard(sol, false))
        )}
      </div>
    </div>
  );
}
