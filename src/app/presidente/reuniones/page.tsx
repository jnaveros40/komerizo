'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import '@/components/reuniones.css';

interface Reunion {
  id: number;
  creador_id: number;
  titulo: string;
  descripcion: string;
  tipo_reunion: string;
  lugar: string;
  fecha_reunion: string;
  hora_inicio: string;
  hora_fin: string;
  estado: string;
  es_obligatoria: boolean;
  requiere_confirmacion: boolean;
  comuna_id: number;
  barrio_id: number;
  roles_invitados: number[];
  fecha_creacion: string;
}

interface Confirmacion {
  id: number;
  usuario_id: number;
  estado_confirmacion: string;
  observaciones: string;
  fecha_confirmacion: string;
}

interface Usuario {
  id: string;
  nombre: string;
  cc: string;
  rol_id: number;
}

export default function PresidenteReuniones() {
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [filteredReuniones, setFilteredReuniones] = useState<Reunion[]>([]);
  const [loading, setLoading] = useState(true);
  const [presidenteRoleId, setPresidenteRoleId] = useState<number | null>(null);
  const [actualizarDatos, setActualizarDatos] = useState(false);

  const [filtros, setFiltros] = useState({
    estado: 'todos',
    tipo: 'todos',
    fecha: '',
  });

  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    titulo: '',
    descripcion: '',
    tipo_reunion: 'Reunion',
    lugar: '',
    fecha_reunion: '',
    hora_inicio: '',
    hora_fin: '',
    es_obligatoria: false,
    requiere_confirmacion: true,
    roles_invitados: [] as number[],
  });

  const [rolesDisponibles, setRolesDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [confirmacionesMap, setConfirmacionesMap] = useState<Map<number, Confirmacion[]>>(new Map());
  const [usuarioData, setUsuarioData] = useState<any>(null);

  // Obtener ID del presidente y cargar reuniones
  useEffect(() => {
    const loadPresidencialData = async () => {
      try {
        setLoading(true);

        // Obtener usuario del localStorage
        const storedUser = localStorage.getItem('komerizo_user');
        if (!storedUser) {
          console.error('No hay usuario en sesión');
          return;
        }

        const user = JSON.parse(storedUser);
        const usuarioId = user.id;

        // Cargar datos completos del usuario (incluyendo comuna y barrio)
        const { data: userData, error: userError } = await supabase
          .from('komerizo_usuarios')
          .select('id, nombre, cc, comuna_id, barrio_id')
          .eq('id', usuarioId)
          .single();

        if (userError) {
          console.error('Error cargando datos del usuario:', userError);
        } else if (userData) {
          console.log('✅ Datos del usuario cargados:', userData);
          setUsuarioData(userData);
        }

        // Obtener todos los roles disponibles
        const { data: allRoles, error: allRolesError } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .order('nombre');

        if (allRolesError) {
          console.error('Error cargando roles:', allRolesError);
        } else {
          setRolesDisponibles(allRoles || []);
        }

        // Cargar reuniones creadas por este usuario
        await loadReuniones(usuarioId);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPresidencialData();
  }, [actualizarDatos]);

  // Cargar reuniones
  const loadReuniones = async (usuarioId: number) => {
    try {
      const { data, error } = await supabase
        .from('komerizo_reuniones')
        .select('*')
        .eq('creador_id', usuarioId)
        .order('fecha_reunion', { ascending: true });

      if (error) throw error;

      setReuniones(data || []);

      // Cargar confirmaciones
      if (data && data.length > 0) {
        const reunionIds = data.map((r) => r.id);

        for (const reunionId of reunionIds) {
          const { data: confirmaciones, error: confError } = await supabase
            .from('komerizo_reuniones_confirmaciones')
            .select('*')
            .eq('reunion_id', reunionId);

          if (confError) throw confError;

          setConfirmacionesMap((prev) => new Map(prev).set(reunionId, confirmaciones || []));
        }
      }
    } catch (error) {
      console.error('Error cargando reuniones:', error);
    }
  };

  // Aplicar filtros
  useEffect(() => {
    let filtered = [...reuniones];

    if (filtros.estado !== 'todos') {
      filtered = filtered.filter((r) => r.estado === filtros.estado);
    }

    if (filtros.tipo !== 'todos') {
      filtered = filtered.filter((r) => r.tipo_reunion === filtros.tipo);
    }

    if (filtros.fecha) {
      filtered = filtered.filter((r) => r.fecha_reunion === filtros.fecha);
    }

    setFilteredReuniones(filtered);
  }, [reuniones, filtros]);

  // Crear nueva reunión
  const handleCrearReunion = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) {
        alert('No hay usuario en sesión');
        return;
      }

      const user = JSON.parse(storedUser);
      const usuarioId = user.id;

      // Obtener comuna y barrio del usuario
      const comunaId = usuarioData?.comuna_id || null;
      const barrioId = usuarioData?.barrio_id || null;

      console.log('📝 Creando reunión con - Comuna:', comunaId, 'Barrio:', barrioId, 'usuarioData:', usuarioData);

      const reunionData = {
        creador_id: usuarioId,
        titulo: formData.titulo,
        descripcion: formData.descripcion,
        tipo_reunion: formData.tipo_reunion,
        lugar: formData.lugar,
        fecha_reunion: formData.fecha_reunion,
        hora_inicio: formData.hora_inicio,
        hora_fin: formData.hora_fin,
        es_obligatoria: formData.es_obligatoria,
        requiere_confirmacion: formData.requiere_confirmacion,
        roles_invitados: formData.roles_invitados,
        comuna_id: comunaId,
        barrio_id: barrioId,
        estado: 'pendiente',
      };

      console.log('🔍 Datos a insertar:', JSON.stringify(reunionData, null, 2));

      const { data: insertData, error } = await supabase.from('komerizo_reuniones').insert([reunionData]);

      if (error) {
        console.error('❌ Error insertando reunión:', error);
        throw error;
      }

      console.log('✅ Reunión insertada:', insertData);

      alert('Reunión creada exitosamente');
      setShowForm(false);
      setFormData({
        titulo: '',
        descripcion: '',
        tipo_reunion: 'Reunion',
        lugar: '',
        fecha_reunion: '',
        hora_inicio: '',
        hora_fin: '',
        es_obligatoria: false,
        requiere_confirmacion: true,
        roles_invitados: [],
      });
      setActualizarDatos(!actualizarDatos);
    } catch (error) {
      console.error('Error creando reunión:', error);
      alert('Error al crear la reunión');
    }
  };

  // Cambiar estado de reunión
  const handleCambiarEstado = async (reunionId: number, nuevoEstado: string) => {
    try {
      const { error } = await supabase
        .from('komerizo_reuniones')
        .update({ estado: nuevoEstado })
        .eq('id', reunionId);

      if (error) throw error;

      setActualizarDatos(!actualizarDatos);
    } catch (error) {
      console.error('Error actualizando reunión:', error);
    }
  };

  // Cancelar reunión
  const handleCancelarReunion = async (reunionId: number) => {
    if (!confirm('¿Está seguro que desea cancelar esta reunión?')) return;

    await handleCambiarEstado(reunionId, 'cancelada');
  };

  // Renderizar card de reunión
  const renderReunionCard = (reunion: Reunion) => {
    const confirmaciones = confirmacionesMap.get(reunion.id) || [];
    const confirmados = confirmaciones.filter((c) => c.estado_confirmacion === 'confirmado').length;
    const rechazados = confirmaciones.filter((c) => c.estado_confirmacion === 'rechazado').length;
    const sinResponder = confirmaciones.filter((c) => c.estado_confirmacion === 'sin_responder').length;

    return (
      <div key={reunion.id} className="reunion-card">
        <div className="reunion-header">
          <div style={{ flex: 1 }}>
            <h3 className="reunion-titulo">{reunion.titulo}</h3>
            <span className="reunion-tipo">{reunion.tipo_reunion}</span>
          </div>
          <span className={`estado-badge ${reunion.estado}`}>{reunion.estado.toUpperCase()}</span>
        </div>

        <div className="reunion-meta">
          <div className="meta-item">
            <span className="meta-icon">📅</span>
            {new Date(reunion.fecha_reunion).toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          {reunion.hora_inicio && (
            <div className="meta-item">
              <span className="meta-icon">⏰</span>
              {reunion.hora_inicio} {reunion.hora_fin && `- ${reunion.hora_fin}`}
            </div>
          )}
          {reunion.lugar && (
            <div className="reunion-lugar">
              <span>📍</span>
              {reunion.lugar}
            </div>
          )}
        </div>

        <div className="reunion-descripcion">{reunion.descripcion}</div>

        {reunion.requiere_confirmacion && confirmaciones.length > 0 && (
          <div className="reunion-confirmaciones">
            <div className="confirmaciones-label">Confirmaciones</div>
            <div className="reunion-meta">
              <div className="meta-item">
                ✅ Confirmados: <strong>{confirmados}</strong>
              </div>
              <div className="meta-item">
                ❌ Rechazados: <strong>{rechazados}</strong>
              </div>
              <div className="meta-item">
                ⏳ Sin responder: <strong>{sinResponder}</strong>
              </div>
            </div>
          </div>
        )}

        {reunion.roles_invitados.length > 0 && (
          <div className="reunion-roles">
            <div className="roles-label">Roles Invitados</div>
            <div className="roles-list">
              {reunion.roles_invitados.map((roleId) => {
                const role = rolesDisponibles.find((r) => r.id === roleId);
                return (
                  <span key={roleId} className="role-badge">
                    {role?.nombre || `Rol ${roleId}`}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {reunion.estado === 'pendiente' && (
          <div className="reunion-acciones">
            <button
              className="btn-reunion btn-editar"
              onClick={() => handleCambiarEstado(reunion.id, 'confirmada')}
            >
              Confirmar
            </button>
            <button
              className="btn-reunion btn-cancelar-reunion"
              onClick={() => handleCancelarReunion(reunion.id)}
            >
              Cancelar
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
          <p>Cargando reuniones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="reuniones-container">
      <div className="reuniones-header">
        <div>
          <h1>Reuniones</h1>
          <p className="header-subtitle">Gestiona las reuniones, juntas y eventos</p>
        </div>
        <button className="btn-nueva-reunion" onClick={() => setShowForm(true)}>
          ➕ Nueva Reunión
        </button>
      </div>

      {/* Filtros */}
      <div className="filtro-reuniones">
        <div className="filtro-group">
          <label className="filtro-label">Estado</label>
          <select
            className="filtro-select"
            value={filtros.estado}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
          >
            <option value="todos">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="confirmada">Confirmada</option>
            <option value="realizada">Realizada</option>
            <option value="cancelada">Cancelada</option>
          </select>
        </div>

        <div className="filtro-group">
          <label className="filtro-label">Tipo</label>
          <select
            className="filtro-select"
            value={filtros.tipo}
            onChange={(e) => setFiltros({ ...filtros, tipo: e.target.value })}
          >
            <option value="todos">Todas</option>
            <option value="Reunion">Reunión</option>
            <option value="Junta">Junta</option>
            <option value="Elecciones">Elecciones</option>
            <option value="Capacitacion">Capacitación</option>
            <option value="Evento">Evento</option>
          </select>
        </div>

        <div className="filtro-group">
          <label className="filtro-label">Fecha</label>
          <input
            type="date"
            className="filtro-input"
            value={filtros.fecha}
            onChange={(e) => setFiltros({ ...filtros, fecha: e.target.value })}
          />
        </div>

        <button
          className="filtro-btn-reset"
          onClick={() => setFiltros({ estado: 'todos', tipo: 'todos', fecha: '' })}
        >
          Limpiar filtros
        </button>
      </div>

      {/* Lista de reuniones */}
      {filteredReuniones.length === 0 ? (
        <div className="no-reuniones">
          <p>No hay reuniones para mostrar</p>
        </div>
      ) : (
        <div className="reuniones-list">{filteredReuniones.map(renderReunionCard)}</div>
      )}

      {/* Modal para nueva reunión */}
      {showForm && (
        <div className="modal-overlay active">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Nueva Reunión</h2>
              <button className="btn-cerrar" onClick={() => setShowForm(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearReunion}>
              <div className="form-group">
                <label className="form-label">Título *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción *</label>
                <textarea
                  className="form-textarea"
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Tipo de Reunión *</label>
                <select
                  className="form-select"
                  value={formData.tipo_reunion}
                  onChange={(e) => setFormData({ ...formData, tipo_reunion: e.target.value })}
                >
                  <option>Reunion</option>
                  <option>Junta</option>
                  <option>Elecciones</option>
                  <option>Capacitacion</option>
                  <option>Evento</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Lugar</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.lugar}
                  onChange={(e) => setFormData({ ...formData, lugar: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Fecha de Reunión *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.fecha_reunion}
                  onChange={(e) => setFormData({ ...formData, fecha_reunion: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hora Inicio</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.hora_inicio}
                  onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Hora Fin</label>
                <input
                  type="time"
                  className="form-input"
                  value={formData.hora_fin}
                  onChange={(e) => setFormData({ ...formData, hora_fin: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Roles a Invitar *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem', background: '#0f172a', borderRadius: '6px', border: '1px solid #475569' }}>
                  {rolesDisponibles.length === 0 ? (
                    <p style={{ color: '#a1aec6', margin: 0 }}>Cargando roles...</p>
                  ) : (
                    rolesDisponibles.map((role) => (
                      <label key={role.id} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'pointer', color: '#cbd5e1' }}>
                        <input
                          type="checkbox"
                          value={role.id}
                          checked={formData.roles_invitados.includes(role.id)}
                          onChange={(e) => {
                            const roleId = parseInt(e.target.value);
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                roles_invitados: [...formData.roles_invitados, roleId],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                roles_invitados: formData.roles_invitados.filter((id) => id !== roleId),
                              });
                            }
                          }}
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                        />
                        <span>{role.nombre}</span>
                      </label>
                    ))
                  )}
                </div>
                {formData.roles_invitados.length === 0 && (
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: '0.5rem 0 0 0' }}>Selecciona al menos un rol</p>
                )}
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={formData.es_obligatoria}
                    onChange={(e) => setFormData({ ...formData, es_obligatoria: e.target.checked })}
                  />
                  <span className="form-label" style={{ margin: 0 }}>
                    Es obligatoria
                  </span>
                </label>
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={formData.requiere_confirmacion}
                    onChange={(e) =>
                      setFormData({ ...formData, requiere_confirmacion: e.target.checked })
                    }
                  />
                  <span className="form-label" style={{ margin: 0 }}>
                    Requiere confirmación
                  </span>
                </label>
              </div>

              <div className="form-actions">
                <button type="submit" className="btn-guardar">
                  Crear Reunión
                </button>
                <button
                  type="button"
                  className="btn-cancelar-form"
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
