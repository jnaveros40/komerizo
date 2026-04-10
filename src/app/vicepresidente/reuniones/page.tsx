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

export default function VicepresidenteReuniones() {
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [filteredReuniones, setFilteredReuniones] = useState<Reunion[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRoleId, setUserRoleId] = useState<number | null>(null);
  const [usuarioId, setUsuarioId] = useState<number | null>(null);
  const [actualizarDatos, setActualizarDatos] = useState(false);

  const [filtros, setFiltros] = useState({
    estado: 'todos',
    tipo: 'todos',
    mi_confirmacion: 'todos',
  });

  const [rolesDisponibles, setRolesDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [confirmacionesMap, setConfirmacionesMap] = useState<Map<number, Confirmacion>>(new Map());

  // Cargar datos del usuario y reuniones invitadas
  useEffect(() => {
    const loadUserData = async () => {
      try {
        setLoading(true);

        // Obtener usuario del localStorage
        const storedUser = localStorage.getItem('komerizo_user');
        if (!storedUser) {
          console.error('No hay usuario en sesión');
          return;
        }

        const user = JSON.parse(storedUser);
        setUsuarioId(user.id);

        // Obtener todos los roles disponibles
        const { data: allRoles, error: allRolesError } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .order('nombre');

        if (allRolesError) {
          console.error('Error cargando roles:', allRolesError);
          return;
        }

        setRolesDisponibles(allRoles || []);

        // Obtener el ID del rol "Vicepresidente"
        const vicepresidenteRole = allRoles?.find((r) => r.nombre === 'Vicepresidente');
        const rolId = vicepresidenteRole?.id;

        if (!rolId) {
          console.error('No se encontró el rol de Vicepresidente');
          return;
        }

        setUserRoleId(rolId);

        // Cargar todas las reuniones (donde su rol fue invitado)
        await loadReunionesInvitadas(rolId, user.id);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [actualizarDatos]);

  // Cargar reuniones donde el usuario fue invitado
  const loadReunionesInvitadas = async (userRoleId: number, usuarioId: number) => {
    try {
      // Cargar TODAS las reuniones
      const { data, error } = await supabase
        .from('komerizo_reuniones')
        .select('*')
        .order('fecha_reunion', { ascending: true });

      if (error) throw error;

      console.log(`💾 Todas las reuniones cargadas:`, data?.length);
      data?.forEach((r) => {
        console.log(`  - Reunión "${r.titulo}": roles_invitados = ${JSON.stringify(r.roles_invitados)}`);
      });

      // Filtrar solo las donde el rol del usuario está en roles_invitados
      const reunionesInvitadas = data?.filter((r) => r.roles_invitados.includes(userRoleId)) || [];
      console.log(`📅 Reuniones para rol ${userRoleId}:`, reunionesInvitadas.length);

      setReuniones(reunionesInvitadas);

      // Cargar confirmaciones del usuario
      if (reunionesInvitadas.length > 0) {
        const reunionIds = reunionesInvitadas.map((r) => r.id);

        for (const reunionId of reunionIds) {
          const { data: confirmaciones, error: confError } = await supabase
            .from('komerizo_reuniones_confirmaciones')
            .select('*')
            .eq('reunion_id', reunionId)
            .eq('usuario_id', usuarioId)
            .single();

          if (confError && confError.code !== 'PGRST116') {
            console.error('Error cargando confirmación:', confError);
          } else if (confirmaciones) {
            setConfirmacionesMap((prev) => new Map(prev).set(reunionId, confirmaciones));
          }
        }
      }
    } catch (error) {
      console.error('Error cargando reuniones invitadas:', error);
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

    if (filtros.mi_confirmacion !== 'todos') {
      filtered = filtered.filter((r) => {
        const confirmacion = confirmacionesMap.get(r.id);
        if (filtros.mi_confirmacion === 'sin_responder') {
          return !confirmacion;
        }
        return confirmacion?.estado_confirmacion === filtros.mi_confirmacion;
      });
    }

    setFilteredReuniones(filtered);
  }, [reuniones, filtros, confirmacionesMap]);

  // Confirmar asistencia
  const handleConfirmarAsistencia = async (reunionId: number, estado: 'confirmado' | 'rechazado') => {
    try {
      if (!usuarioId) return;

      // Verificar si ya existe confirmación
      const existente = confirmacionesMap.get(reunionId);

      if (existente) {
        // Actualizar
        const { error } = await supabase
          .from('komerizo_reuniones_confirmaciones')
          .update({ estado_confirmacion: estado })
          .eq('id', existente.id);

        if (error) throw error;
      } else {
        // Crear nueva
        const { error } = await supabase.from('komerizo_reuniones_confirmaciones').insert([
          {
            reunion_id: reunionId,
            usuario_id: usuarioId,
            estado_confirmacion: estado,
          },
        ]);

        if (error) throw error;
      }

      setActualizarDatos(!actualizarDatos);
    } catch (error) {
      console.error('Error confirmando asistencia:', error);
      alert('Error al actualizar tu confirmación');
    }
  };

  // Renderizar card de reunión
  const renderReunionCard = (reunion: Reunion) => {
    const miConfirmacion = confirmacionesMap.get(reunion.id);
    const estaInvitado = reunion.roles_invitados.includes(userRoleId || -1);

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

        {/* Mostrar estado de mi confirmación */}
        {miConfirmacion && (
          <div className="reunion-mi-confirmacion">
            <span className={`confirmacion-badge ${miConfirmacion.estado_confirmacion}`}>
              Tu respuesta: {miConfirmacion.estado_confirmacion === 'confirmado' ? '✅ Confirmado' : '❌ Rechazado'}
            </span>
          </div>
        )}

        {/* Botones de confirmar/rechazar SOLO si fue invitado y no ha respondido o puede cambiar respuesta */}
        {estaInvitado && reunion.requiere_confirmacion && (
          <div className="reunion-acciones">
            <button
              className="btn-reunion btn-editar"
              onClick={() => handleConfirmarAsistencia(reunion.id, 'confirmado')}
              disabled={miConfirmacion?.estado_confirmacion === 'confirmado'}
              style={{
                opacity: miConfirmacion?.estado_confirmacion === 'confirmado' ? 0.6 : 1,
              }}
            >
              ✅ Confirmar
            </button>
            <button
              className="btn-reunion btn-cancelar-reunion"
              onClick={() => handleConfirmarAsistencia(reunion.id, 'rechazado')}
              disabled={miConfirmacion?.estado_confirmacion === 'rechazado'}
              style={{
                opacity: miConfirmacion?.estado_confirmacion === 'rechazado' ? 0.6 : 1,
              }}
            >
              ❌ Rechazar
            </button>
          </div>
        )}

        {/* Si no fue invitado, mostrar mensaje */}
        {!estaInvitado && (
          <div style={{ color: '#a1aec6', fontSize: '0.9rem', fontStyle: 'italic', marginTop: '1rem' }}>
            No fuiste invitado a esta reunión
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
          <p className="header-subtitle">Confirmación de asistencia a reuniones</p>
        </div>
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
          <label className="filtro-label">Mi Confirmación</label>
          <select
            className="filtro-select"
            value={filtros.mi_confirmacion}
            onChange={(e) => setFiltros({ ...filtros, mi_confirmacion: e.target.value })}
          >
            <option value="todos">Todas</option>
            <option value="confirmado">Confirmadas</option>
            <option value="rechazado">Rechazadas</option>
            <option value="sin_responder">Sin responder</option>
          </select>
        </div>

        <button
          className="filtro-btn-reset"
          onClick={() => setFiltros({ estado: 'todos', tipo: 'todos', mi_confirmacion: 'todos' })}
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
    </div>
  );
}
