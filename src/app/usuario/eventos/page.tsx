'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import '@/components/reuniones.css';
import '../usuario.css';

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
  reunion_id: number;
  estado_confirmacion: string;
  observaciones: string;
  fecha_confirmacion: string;
}

export default function UsuarioEventosPage() {
  const [reuniones, setReuniones] = useState<Reunion[]>([]);
  const [filteredReuniones, setFilteredReuniones] = useState<Reunion[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRoleIds, setUserRoleIds] = useState<number[]>([]);
  const [usuarioData, setUsuarioData] = useState<any>(null);

  const [filtros, setFiltros] = useState({
    estado: 'todos',
    tipo: 'todos',
    fecha: '',
  });

  const [rolesDisponibles, setRolesDisponibles] = useState<{ id: number; nombre: string }[]>([]);
  const [confirmacionesMap, setConfirmacionesMap] = useState<Map<number, Confirmacion[]>>(new Map());
  const [miConfirmacionMap, setMiConfirmacionMap] = useState<Map<number, Confirmacion | null>>(new Map());

  // Cargar datos del usuario
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);

        const storedUser = localStorage.getItem('komerizo_user');
        if (!storedUser) {
          console.error('No hay usuario en sesión');
          return;
        }

        const user = JSON.parse(storedUser);

        // Cargar datos del usuario
        const { data: userData, error: userError } = await supabase
          .from('komerizo_usuarios')
          .select('id, nombre, cc, comuna_id, barrio_id')
          .eq('id', user.id)
          .single();

        if (userError) {
          console.error('Error cargando datos del usuario:', userError);
        } else if (userData) {
          console.log('✅ Datos del usuario cargados:', userData);
          setUsuarioData(userData);
        }

        // Obtener roles del usuario
        const { data: userRolesData, error: userRolesError } = await supabase
          .from('komerizo_usuario_roles')
          .select('rol_id')
          .eq('usuario_id', user.id);

        if (userRolesError) {
          console.error('Error cargando roles:', userRolesError);
          return;
        }

        const roleIds = userRolesData?.map((r) => r.rol_id) || [];
        setUserRoleIds(roleIds);
        console.log('👤 Roles del usuario:', roleIds);

        // Cargar roles disponibles
        const { data: allRoles, error: allRolesError } = await supabase
          .from('komerizo_roles')
          .select('id, nombre')
          .order('nombre');

        if (allRolesError) {
          console.error('Error cargando roles:', allRolesError);
          return;
        }

        setRolesDisponibles(allRoles || []);

        // Cargar reuniones
        await loadReuniones(user.id, roleIds);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Cargar reuniones invitadas al usuario
  const loadReuniones = async (userId: number, roleIds: number[]) => {
    try {
      // Obtener comuna y barrio del usuario
      const storedUser = localStorage.getItem('komerizo_user');
      let comunaId = null;
      let barrioId = null;

      if (storedUser) {
        const user = JSON.parse(storedUser);
        comunaId = user.comuna_id;
        barrioId = user.barrio_id;
      }

      console.log('🎯 Filtrando reuniones por - Comuna:', comunaId, 'Barrio:', barrioId, 'Roles:', roleIds);

      // Cargar reuniones de LA MISMA COMUNA Y BARRIO del usuario
      let query = supabase
        .from('komerizo_reuniones')
        .select('*')
        .order('fecha_reunion', { ascending: true });

      if (comunaId) {
        query = query.eq('comuna_id', comunaId);
      }

      if (barrioId) {
        query = query.eq('barrio_id', barrioId);
      }

      const { data: allReuniones, error: reunionesError } = await query;

      if (reunionesError) throw reunionesError;

      // Filtrar solo las reuniones donde el usuario fue invitado (por rol)
      const reunionesInvitadas = (allReuniones || []).filter((reunion) =>
        reunion.roles_invitados.some((roleId: number) => roleIds.includes(roleId))
      );

      console.log('📊 Reuniones encontradas:', reunionesInvitadas.length);
      setReuniones(reunionesInvitadas);

      // Cargar confirmaciones
      if (reunionesInvitadas.length > 0) {
        const reunionIds = reunionesInvitadas.map((r) => r.id);

        // Cargar confirmaciones generales de cada reunión
        for (const reunionId of reunionIds) {
          const { data: confirmaciones, error: confError } = await supabase
            .from('komerizo_reuniones_confirmaciones')
            .select('*')
            .eq('reunion_id', reunionId);

          if (confError) throw confError;

          setConfirmacionesMap((prev) => new Map(prev).set(reunionId, confirmaciones || []));
        }

        // Cargar mi confirmación específica
        const { data: miConfirmaciones, error: miConfError } = await supabase
          .from('komerizo_reuniones_confirmaciones')
          .select('*')
          .eq('usuario_id', userId)
          .in('reunion_id', reunionIds);

        if (miConfError) throw miConfError;

        miConfirmaciones?.forEach((conf) => {
          setMiConfirmacionMap((prev) => new Map(prev).set(conf.reunion_id, conf));
        });
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

  // Confirmar asistencia
  const handleConfirmar = async (reunionId: number) => {
    try {
      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) return;

      const user = JSON.parse(storedUser);

      // Verificar si ya existe confirmación
      const existente = miConfirmacionMap.get(reunionId);

      if (existente) {
        // Actualizar
        const { error } = await supabase
          .from('komerizo_reuniones_confirmaciones')
          .update({ estado_confirmacion: 'confirmado', fecha_confirmacion: new Date().toISOString() })
          .eq('id', existente.id);

        if (error) throw error;
      } else {
        // Crear
        const { error } = await supabase
          .from('komerizo_reuniones_confirmaciones')
          .insert([
            {
              reunion_id: reunionId,
              usuario_id: user.id,
              estado_confirmacion: 'confirmado',
              fecha_confirmacion: new Date().toISOString(),
            },
          ]);

        if (error) throw error;
      }

      alert('Asistencia confirmada');
      window.location.reload();
    } catch (error) {
      console.error('Error confirmando:', error);
      alert('Error al confirmar asistencia');
    }
  };

  // Rechazar asistencia
  const handleRechazar = async (reunionId: number) => {
    try {
      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) return;

      const user = JSON.parse(storedUser);

      const existente = miConfirmacionMap.get(reunionId);

      if (existente) {
        const { error } = await supabase
          .from('komerizo_reuniones_confirmaciones')
          .update({ estado_confirmacion: 'rechazado', fecha_confirmacion: new Date().toISOString() })
          .eq('id', existente.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('komerizo_reuniones_confirmaciones')
          .insert([
            {
              reunion_id: reunionId,
              usuario_id: user.id,
              estado_confirmacion: 'rechazado',
              fecha_confirmacion: new Date().toISOString(),
            },
          ]);

        if (error) throw error;
      }

      alert('Asistencia rechazada');
      window.location.reload();
    } catch (error) {
      console.error('Error rechazando:', error);
      alert('Error al rechazar asistencia');
    }
  };

  // Renderizar card de reunión
  const renderReunionCard = (reunion: Reunion) => {
    const confirmaciones = confirmacionesMap.get(reunion.id) || [];
    const confirmados = confirmaciones.filter((c) => c.estado_confirmacion === 'confirmado').length;
    const rechazados = confirmaciones.filter((c) => c.estado_confirmacion === 'rechazado').length;
    const sinResponder = confirmaciones.filter((c) => c.estado_confirmacion === 'sin_responder').length;
    const miConfirmacion = miConfirmacionMap.get(reunion.id);

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

        {reunion.es_obligatoria && (
          <div style={{ color: '#ff6b6b', fontSize: '0.9rem', marginTop: '0.5rem', fontWeight: '600' }}>
            ⚠️ Esta reunión es obligatoria
          </div>
        )}

        {/* Mi confirmación */}
        {reunion.requiere_confirmacion && reunion.estado === 'pendiente' && (
          <div className="reunion-acciones">
            <button
              className={`btn-reunion ${miConfirmacion?.estado_confirmacion === 'confirmado' ? 'btn-activo' : 'btn-editar'}`}
              onClick={() => handleConfirmar(reunion.id)}
            >
              {miConfirmacion?.estado_confirmacion === 'confirmado' ? '✅ Confirmado' : '✅ Confirmar Asistencia'}
            </button>
            <button
              className={`btn-reunion ${miConfirmacion?.estado_confirmacion === 'rechazado' ? 'btn-activo' : 'btn-cancelar-reunion'}`}
              onClick={() => handleRechazar(reunion.id)}
            >
              {miConfirmacion?.estado_confirmacion === 'rechazado' ? '❌ Rechazado' : '❌ No Puedo Asistir'}
            </button>
          </div>
        )}

        {reunion.estado !== 'pendiente' && (
          <div style={{ color: '#a1aec6', fontSize: '0.9rem', fontStyle: 'italic', marginTop: '1rem' }}>
            Esta reunión ya fue {reunion.estado}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="usuario-container">
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Cargando eventos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="usuario-container">
      <div className="usuario-header">
        <div>
          <h1>📅 Eventos</h1>
          <p className="header-subtitle">Reuniones, asambleas y eventos del JAC</p>
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
            <option value="todos">Todos</option>
            <option value="Reunion">Reunión</option>
            <option value="Asamblea">Asamblea</option>
            <option value="Evento">Evento</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
      </div>

      {/* Lista de reuniones */}
      {filteredReuniones.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No hay eventos para ti</h3>
          <p>
            Aquí aparecerán los próximos eventos, asambleas y actividades a las que hayas sido invitado.
          </p>
        </div>
      ) : (
        <div className="reuniones-grid">
          {filteredReuniones.map((reunion) => renderReunionCard(reunion))}
        </div>
      )}
    </div>
  );
}
