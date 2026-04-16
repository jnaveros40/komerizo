'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import '@/components/reuniones.css';

interface SalonConfig {
  id: number;
  valor_por_hora: number;
  valor_por_dia: number;
  hora_apertura: string;
  hora_cierre: string;
  descripcion: string;
  estado: string;
}

interface Alquiler {
  id: number;
  usuario_id: number;
  rol_id: number;
  fecha_inicio: string;
  fecha_fin: string;
  hora_inicio: string;
  hora_fin: string;
  tipo_alquiler: string;
  cantidad: number;
  valor_total: number;
  motivo: string;
  estado: string;
  creado_at: string;
}

export default function TesoreroSalonPage() {
  const [tab, setTab] = useState<'config' | 'reservas'>('config');
  const [config, setConfig] = useState<SalonConfig | null>(null);
  const [alquileres, setAlquileres] = useState<Alquiler[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);

  const [formConfig, setFormConfig] = useState({
    valor_por_hora: 0,
    valor_por_dia: 0,
    hora_apertura: '08:00',
    hora_cierre: '22:00',
    descripcion: '',
  });

  const [showFormConfig, setShowFormConfig] = useState(false);
  const [editingConfig, setEditingConfig] = useState(false);

  // Cargar datos
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) return;

      const userData = JSON.parse(storedUser);
      setUsuario(userData);

      // Cargar configuración
      const { data: configData, error: configError } = await supabase
        .from('komerizo_salon_config')
        .select('*')
        .eq('estado', 'activo')
        .single();

      if (configData) {
        setConfig(configData);
        setFormConfig({
          valor_por_hora: configData.valor_por_hora,
          valor_por_dia: configData.valor_por_dia,
          hora_apertura: configData.hora_apertura?.substring(0, 5),
          hora_cierre: configData.hora_cierre?.substring(0, 5),
          descripcion: configData.descripcion || '',
        });
      }

      // Cargar alquileres
      const { data: alquileresData, error: alquileresError } = await supabase
        .from('komerizo_alquileres')
        .select('*')
        .order('fecha_inicio', { ascending: false });

      if (alquileresData) {
        setAlquileres(alquileresData);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (config) {
        // Actualizar configuración existente
        const { error } = await supabase
          .from('komerizo_salon_config')
          .update({
            valor_por_hora: formConfig.valor_por_hora,
            valor_por_dia: formConfig.valor_por_dia,
            hora_apertura: formConfig.hora_apertura + ':00',
            hora_cierre: formConfig.hora_cierre + ':00',
            descripcion: formConfig.descripcion,
            fecha_actualizacion: new Date().toISOString(),
            actualizado_por: usuario.id,
          })
          .eq('id', config.id);

        if (error) throw error;

        // Registrar en historial
        await supabase.from('komerizo_salon_historial').insert([
          {
            usuario_id: usuario.id,
            rol_id: 2, // Tesorero
            valor_anterior: {
              valor_por_hora: config.valor_por_hora,
              valor_por_dia: config.valor_por_dia,
            },
            valor_nuevo: {
              valor_por_hora: formConfig.valor_por_hora,
              valor_por_dia: formConfig.valor_por_dia,
            },
            justificacion: 'Actualización de tarifas',
          },
        ]);
      } else {
        // Crear nueva configuración
        const { data: newConfig, error } = await supabase
          .from('komerizo_salon_config')
          .insert([
            {
              valor_por_hora: formConfig.valor_por_hora,
              valor_por_dia: formConfig.valor_por_dia,
              hora_apertura: formConfig.hora_apertura + ':00',
              hora_cierre: formConfig.hora_cierre + ':00',
              descripcion: formConfig.descripcion,
              actualizado_por: usuario.id,
            },
          ])
          .select()
          .single();

        if (error) throw error;
        setConfig(newConfig);
      }

      alert('Configuración guardada exitosamente');
      setShowFormConfig(false);
      setEditingConfig(false);
      await loadData();
    } catch (error) {
      console.error('Error guardando configuración:', error);
      alert('Error al guardar la configuración');
    }
  };

  const handleCancelarAlquiler = async (alquilerId: number) => {
    if (!confirm('¿Deseas cancelar esta reserva?')) return;

    try {
      const { error } = await supabase
        .from('komerizo_alquileres')
        .update({ estado: 'cancelado', actualizado_at: new Date().toISOString() })
        .eq('id', alquilerId);

      if (error) throw error;

      alert('Reserva cancelada');
      await loadData();
    } catch (error) {
      console.error('Error cancelando alquiler:', error);
      alert('Error al cancelar la reserva');
    }
  };

  const handleConsumoInterno = async (alquilerId: number, currentValor: number) => {
    const isInterno = currentValor === 0;
    
    if (isInterno) {
      alert('Esta reserva ya está marcada como consumo interno (valor $0).');
      return;
    }

    if (!confirm('¿Deseas marcar esta reserva como Consumo Interno? El valor total pasará a $0.')) return;

    try {
      const { error } = await supabase
        .from('komerizo_alquileres')
        .update({ valor_total: 0, actualizado_at: new Date().toISOString() })
        .eq('id', alquilerId);

      if (error) throw error;

      alert('Reserva marcada como Consumo Interno');
      await loadData();
    } catch (error) {
      console.error('Error actualizando alquiler:', error);
      alert('Error al actualizar la reserva');
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#a1aec6' }}>Cargando...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#fff' }}>🏛️ Gestión del Salón Comunal</h1>

      {/* TABS */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '1px solid #3a4a5f' }}>
        <button
          onClick={() => setTab('config')}
          style={{
            padding: '1rem 2rem',
            background: tab === 'config' ? '#6c5ce7' : 'transparent',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderBottom: tab === 'config' ? '2px solid #6c5ce7' : 'none',
          }}
        >
          ⚙️ Configuración de Tarifas
        </button>
        <button
          onClick={() => setTab('reservas')}
          style={{
            padding: '1rem 2rem',
            background: tab === 'reservas' ? '#6c5ce7' : 'transparent',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            borderBottom: tab === 'reservas' ? '2px solid #6c5ce7' : 'none',
          }}
        >
          📅 Reservas ({alquileres.filter(a => a.estado === 'confirmado').length})
        </button>
      </div>

      {/* TAB: CONFIGURACIÓN */}
      {tab === 'config' && (
        <div>
          {config && !showFormConfig && (
            <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #3a4a5f' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>Tarifas Actuales</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                <div style={{ background: '#0f1419', padding: '1.5rem', borderRadius: '4px' }}>
                  <div style={{ color: '#a1aec6', marginBottom: '0.5rem' }}>Valor por Hora</div>
                  <div style={{ fontSize: '1.5rem', color: '#6c5ce7', fontWeight: 'bold' }}>${config.valor_por_hora.toFixed(2)}</div>
                </div>
                <div style={{ background: '#0f1419', padding: '1.5rem', borderRadius: '4px' }}>
                  <div style={{ color: '#a1aec6', marginBottom: '0.5rem' }}>Valor por Día Completo</div>
                  <div style={{ fontSize: '1.5rem', color: '#6c5ce7', fontWeight: 'bold' }}>${config.valor_por_dia.toFixed(2)}</div>
                </div>
                <div style={{ background: '#0f1419', padding: '1.5rem', borderRadius: '4px' }}>
                  <div style={{ color: '#a1aec6', marginBottom: '0.5rem' }}>Horario de Atención</div>
                  <div style={{ color: '#fff' }}>{config.hora_apertura} - {config.hora_cierre}</div>
                </div>
              </div>
              <button
                onClick={() => setEditingConfig(true)}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#6c5ce7',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}
              >
                ✏️ Editar Tarifas
              </button>
            </div>
          )}

          {(editingConfig || !config || showFormConfig) && (
            <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '8px', border: '1px solid #3a4a5f' }}>
              <h3 style={{ marginBottom: '1.5rem' }}>{config ? 'Actualizar Tarifas' : 'Crear Configuración Inicial'}</h3>
              <form onSubmit={handleGuardarConfig}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Valor por Hora ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formConfig.valor_por_hora}
                      onChange={(e) => setFormConfig({ ...formConfig, valor_por_hora: parseFloat(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#0f1419',
                        color: '#fff',
                        border: '1px solid #3a4a5f',
                        borderRadius: '4px',
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Valor por Día Completo ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formConfig.valor_por_dia}
                      onChange={(e) => setFormConfig({ ...formConfig, valor_por_dia: parseFloat(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#0f1419',
                        color: '#fff',
                        border: '1px solid #3a4a5f',
                        borderRadius: '4px',
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Hora de Apertura:</label>
                    <input
                      type="time"
                      value={formConfig.hora_apertura}
                      onChange={(e) => setFormConfig({ ...formConfig, hora_apertura: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#0f1419',
                        color: '#fff',
                        border: '1px solid #3a4a5f',
                        borderRadius: '4px',
                      }}
                      required
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Hora de Cierre:</label>
                    <input
                      type="time"
                      value={formConfig.hora_cierre}
                      onChange={(e) => setFormConfig({ ...formConfig, hora_cierre: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        background: '#0f1419',
                        color: '#fff',
                        border: '1px solid #3a4a5f',
                        borderRadius: '4px',
                      }}
                      required
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Descripción:</label>
                  <textarea
                    value={formConfig.descripcion}
                    onChange={(e) => setFormConfig({ ...formConfig, descripcion: e.target.value })}
                    placeholder="Ej: Salón comunal con capacidad para 100 personas"
                    style={{
                      width: '100%',
                      minHeight: '100px',
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
                  <button type="submit" className="btn-reunion btn-editar" style={{ flex: 1 }}>
                    💾 Guardar Tarifas
                  </button>
                  <button
                    type="button"
                    className="btn-reunion btn-cancelar-reunion"
                    onClick={() => {
                      setEditingConfig(false);
                      setShowFormConfig(false);
                    }}
                    style={{ flex: 1 }}
                  >
                    ✕ Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {!config && !showFormConfig && (
            <button
              onClick={() => setShowFormConfig(true)}
              style={{
                padding: '1rem 2rem',
                background: '#6c5ce7',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1rem',
              }}
            >
              ➕ Crear Configuración Inicial
            </button>
          )}
        </div>
      )}

      {/* TAB: RESERVAS */}
      {tab === 'reservas' && (
        <div>
          <h3 style={{ marginBottom: '1.5rem' }}>Reservas del Salón</h3>
          {alquileres.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#a1aec6' }}>
              No hay reservas registradas
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {alquileres.map((alquiler) => (
                <div
                  key={alquiler.id}
                  className="reunion-card"
                  style={{
                    opacity: alquiler.estado === 'cancelado' ? 0.6 : 1,
                  }}
                >
                  <div className="reunion-header">
                    <div style={{ flex: 1 }}>
                      <h3 className="reunion-titulo">
                        {alquiler.tipo_alquiler === 'por_hora' ? `${alquiler.cantidad}h` : `${alquiler.cantidad}d`}
                      </h3>
                      <span className="reunion-tipo">{alquiler.motivo || 'Sin motivo especificado'}</span>
                    </div>
                    <span className={`estado-badge ${alquiler.estado}`}>{alquiler.estado.toUpperCase()}</span>
                  </div>

                  <div className="reunion-meta">
                    <div className="meta-item">
                      <span className="meta-icon">📅</span>
                      {new Date(alquiler.fecha_inicio).toLocaleDateString('es-ES')}
                      {alquiler.fecha_fin && alquiler.fecha_fin !== alquiler.fecha_inicio && (
                        <> - {new Date(alquiler.fecha_fin).toLocaleDateString('es-ES')}</>
                      )}
                    </div>
                    <div className="meta-item">
                      <span className="meta-icon">💰</span>${alquiler.valor_total.toFixed(2)}
                    </div>
                    {alquiler.tipo_alquiler === 'por_hora' && (
                      <div className="meta-item">
                        <span className="meta-icon">🕐</span>
                        {alquiler.hora_inicio} - {alquiler.hora_fin}
                      </div>
                    )}
                  </div>

                  {alquiler.estado === 'confirmado' && (
                    <div className="reunion-acciones" style={{ display: 'flex', gap: '1rem' }}>
                      {alquiler.valor_total > 0 && (
                        <button
                          onClick={() => handleConsumoInterno(alquiler.id, alquiler.valor_total)}
                          style={{
                            padding: '0.5rem 1rem',
                            background: '#2ecc71',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                          }}
                        >
                          ✓ Consumo Interno ($0)
                        </button>
                      )}
                      <button
                        onClick={() => handleCancelarAlquiler(alquiler.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          background: '#e74c3c',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                        }}
                      >
                        ✕ Cancelar Reserva
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
