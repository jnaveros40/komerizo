'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import '@/components/reuniones.css';

interface Movimiento {
  id: number;
  tipo: 'ingreso' | 'gasto';
  cantidad: number;
  descripcion: string;
  saldo_anterior: number;
  saldo_nuevo: number;
  justificacion: string;
  referencia_externa: string;
  creado_at: string;
  usuario_id: number;
  estado: string;
}

interface SaldoInfo {
  id: number;
  saldo_actual: number;
  saldo_anterior: number;
  actualizado_por: number;
}

export default function TesoreríaPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState<SaldoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [usuario, setUsuario] = useState<any>(null);
  const [userRole, setUserRole] = useState<any>(null);

  const [showFormIngreso, setShowFormIngreso] = useState(false);
  const [showFormGasto, setShowFormGasto] = useState(false);

  const [formMovimiento, setFormMovimiento] = useState({
    cantidad: 0,
    descripcion: '',
    justificacion: '',
    referencia_externa: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('📂 Cargando datos de tesorería...');

      const storedUser = localStorage.getItem('komerizo_user');
      if (!storedUser) {
        console.error('❌ No hay usuario guardado');
        return;
      }

      const userData = JSON.parse(storedUser);
      console.log('👤 Usuario:', userData);
      setUsuario(userData);

      if (userData.roles && userData.roles.length > 0) {
        setUserRole(userData.roles[0]);
      }

      // Cargar movimientos
      console.log('📝 Cargando movimientos...');
      const { data: movimientosData, error: errorMovimientos } = await supabase
        .from('komerizo_tesoreria')
        .select('*')
        .order('creado_at', { ascending: false });

      if (errorMovimientos) {
        console.error('❌ Error cargando movimientos:', errorMovimientos);
      } else {
        console.log('✅ Movimientos cargados:', movimientosData?.length);
        if (movimientosData) {
          setMovimientos(movimientosData);
        }
      }

      // Cargar saldo actual
      console.log('💰 Cargando saldo...');
      const { data: saldoData, error: errorSaldo } = await supabase
        .from('komerizo_tesoreria_saldo')
        .select('*')
        .order('fecha_actualizacion', { ascending: false })
        .limit(1)
        .single();

      if (errorSaldo) {
        console.error('❌ Error cargando saldo:', errorSaldo);
      } else {
        console.log('✅ Saldo cargado:', saldoData);
        if (saldoData) {
          setSaldo(saldoData);
        }
      }
    } catch (error) {
      console.error('❌ Error general en loadData:', error);
    } finally {
      setLoading(false);
      console.log('✅ Carga completada');
    }
  };

  const handleAgregarMovimiento = async (e: React.FormEvent, tipo: 'ingreso' | 'gasto') => {
    e.preventDefault();

    console.log('🔄 Iniciando agregar movimiento...');
    console.log('Tipo:', tipo);
    console.log('Usuario:', usuario);
    console.log('Saldo:', saldo);
    console.log('Formulario:', formMovimiento);

    if (!usuario || !saldo) {
      console.error('❌ Error: Usuario o saldo no disponibles');
      alert('Error: Datos del usuario o saldo no disponibles');
      return;
    }

    if (formMovimiento.cantidad <= 0) {
      console.error('❌ Cantidad inválida:', formMovimiento.cantidad);
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    try {
      const saldoAnterior = saldo.saldo_actual;
      const saldoNuevo = tipo === 'ingreso' 
        ? saldoAnterior + formMovimiento.cantidad
        : saldoAnterior - formMovimiento.cantidad;

      console.log('💰 Cálculos:');
      console.log('  Saldo Anterior:', saldoAnterior);
      console.log('  Saldo Nuevo:', saldoNuevo);
      console.log('  Tipo:', tipo);

      if (tipo === 'gasto' && saldoNuevo < 0) {
        console.error('❌ Saldo insuficiente');
        alert('No hay suficiente saldo para este gasto');
        return;
      }

      // Guardar movimiento
      console.log('📝 Insertando movimiento...');
      console.log('  rol_id que se enviará:', userRole?.id);
      const { data: movimientoData, error: errorMovimiento } = await supabase
        .from('komerizo_tesoreria')
        .insert([
          {
            tipo,
            cantidad: formMovimiento.cantidad,
            descripcion: formMovimiento.descripcion,
            saldo_anterior: saldoAnterior,
            saldo_nuevo: saldoNuevo,
            justificacion: formMovimiento.justificacion,
            referencia_externa: formMovimiento.referencia_externa,
            usuario_id: usuario.id,
            rol_id: userRole?.id || null,
            estado: 'registrado',
          },
        ])
        .select();

      if (errorMovimiento) {
        console.error('❌ Error insertando movimiento:', errorMovimiento);
        throw errorMovimiento;
      }

      console.log('✅ Movimiento insertado:', movimientoData);

      // Actualizar saldo
      console.log('🔄 Actualizando saldo...');
      const { error: errorSaldo } = await supabase
        .from('komerizo_tesoreria_saldo')
        .update({
          saldo_anterior: saldoAnterior,
          saldo_actual: saldoNuevo,
          actualizado_por: usuario.id,
          fecha_actualizacion: new Date().toISOString(),
        })
        .eq('id', saldo.id);

      if (errorSaldo) {
        console.error('❌ Error actualizando saldo:', errorSaldo);
        throw errorSaldo;
      }

      console.log('✅ Saldo actualizado');

      // Registrar en historial
      if (movimientoData && movimientoData.length > 0) {
        console.log('📋 Registrando en historial...');
        const { error: errorHistorial } = await supabase
          .from('komerizo_tesoreria_historial')
          .insert([
            {
              movimiento_id: movimientoData[0].id,
              tipo_cambio: 'creacion',
              valor_nuevo: movimientoData[0],
              razon: `${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} de $${formMovimiento.cantidad}`,
              usuario_id: usuario.id,
            },
          ]);

        if (errorHistorial) {
          console.error('❌ Error registrando historial:', errorHistorial);
        } else {
          console.log('✅ Historial registrado');
        }
      }

      console.log('✅ Movimiento completado exitosamente');
      alert(`${tipo === 'ingreso' ? 'Ingreso' : 'Gasto'} registrado exitosamente`);
      setFormMovimiento({
        cantidad: 0,
        descripcion: '',
        justificacion: '',
        referencia_externa: '',
      });
      setShowFormIngreso(false);
      setShowFormGasto(false);
      await loadData();
    } catch (error) {
      console.error('❌ Error en handleAgregarMovimiento:', error);
      alert('Error al registrar el movimiento');
    }
  };

  const formatearFecha = (fechaString: string) => {
    const date = new Date(fechaString);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div style={{ padding: '2rem', color: '#fff' }}>Cargando...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#fff' }}>💰 Tesorería</h1>

      {/* SALDO ACTUAL */}
      <div
        style={{
          background: 'linear-gradient(135deg, #6c5ce7 0%, #5f3dc4 100%)',
          padding: '2rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #7c6ce7',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2rem' }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Saldo Anterior</div>
            <div style={{ fontSize: '1.8rem', color: '#fff', fontWeight: 'bold' }}>
              ${saldo?.saldo_anterior.toFixed(2) || '0.00'}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Saldo Actual</div>
            <div style={{ fontSize: '2.5rem', color: '#fff', fontWeight: 'bold' }}>
              ${saldo?.saldo_actual.toFixed(2) || '0.00'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(255,255,255,0.8)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Diferencia</div>
            <div
              style={{
                fontSize: '1.8rem',
                color: (saldo?.saldo_actual || 0) >= (saldo?.saldo_anterior || 0) ? '#52C41A' : '#FF4D4F',
                fontWeight: 'bold',
              }}
            >
              ${((saldo?.saldo_actual || 0) - (saldo?.saldo_anterior || 0)).toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {/* BOTONES */}
      {!showFormIngreso && !showFormGasto && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
          <button
            onClick={() => setShowFormIngreso(true)}
            style={{
              padding: '1rem 2rem',
              background: '#52C41A',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            ⬇️ Agregar Ingreso
          </button>
          <button
            onClick={() => setShowFormGasto(true)}
            style={{
              padding: '1rem 2rem',
              background: '#FF4D4F',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold',
            }}
          >
            ⬆️ Registrar Gasto
          </button>
        </div>
      )}

      {/* FORMULARIOS */}
      {(showFormIngreso || showFormGasto) && (
        <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #3a4a5f' }}>
          <h3 style={{ marginBottom: '1.5rem', color: showFormIngreso ? '#52C41A' : '#FF4D4F' }}>
            {showFormIngreso ? '⬇️ Nuevo Ingreso' : '⬆️ Nuevo Gasto'}
          </h3>

          <form
            onSubmit={(e) =>
              handleAgregarMovimiento(e, showFormIngreso ? 'ingreso' : 'gasto')
            }
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Cantidad ($):</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMovimiento.cantidad}
                  onChange={(e) => setFormMovimiento({ ...formMovimiento, cantidad: parseFloat(e.target.value) })}
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
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Referencia (opcional):</label>
                <input
                  type="text"
                  placeholder="Ej: REC-001, FAC-123"
                  value={formMovimiento.referencia_externa}
                  onChange={(e) => setFormMovimiento({ ...formMovimiento, referencia_externa: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: '#0f1419',
                    color: '#fff',
                    border: '1px solid #3a4a5f',
                    borderRadius: '4px',
                  }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Descripción:</label>
              <input
                type="text"
                placeholder="Describe el concepto de este movimiento"
                value={formMovimiento.descripcion}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, descripcion: e.target.value })}
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

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#a1aec6' }}>Justificación:</label>
              <textarea
                placeholder="Explica la razón de este movimiento (para auditoría)"
                value={formMovimiento.justificacion}
                onChange={(e) => setFormMovimiento({ ...formMovimiento, justificacion: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#0f1419',
                  color: '#fff',
                  border: '1px solid #3a4a5f',
                  borderRadius: '4px',
                  minHeight: '80px',
                  fontFamily: 'monospace',
                }}
                required
              />
            </div>

            {/* RESUMEN */}
            <div style={{ background: '#0f1419', padding: '1.5rem', borderRadius: '4px', marginBottom: '1.5rem', border: '1px solid #3a4a5f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a1aec6' }}>Saldo Actual:</span>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>${saldo?.saldo_actual.toFixed(2) || '0.00'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#a1aec6' }}>Cantidad:</span>
                <span style={{ color: '#fff' }}>${formMovimiento.cantidad.toFixed(2)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #3a4a5f',
                  paddingTop: '0.5rem',
                  marginTop: '0.5rem',
                }}
              >
                <span style={{ color: showFormIngreso ? '#52C41A' : '#FF4D4F', fontWeight: 'bold' }}>
                  Saldo Nuevo:
                </span>
                <span
                  style={{
                    color: showFormIngreso ? '#52C41A' : '#FF4D4F',
                    fontSize: '1.2rem',
                    fontWeight: 'bold',
                  }}
                >
                  ${(
                    (saldo?.saldo_actual || 0) +
                    (showFormIngreso ? formMovimiento.cantidad : -formMovimiento.cantidad)
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="submit"
                className="btn-reunion btn-editar"
                style={{ flex: 1, background: showFormIngreso ? '#52C41A' : '#FF4D4F' }}
              >
                ✅ Confirmar
              </button>
              <button
                type="button"
                className="btn-reunion btn-cancelar-reunion"
                onClick={() => {
                  setShowFormIngreso(false);
                  setShowFormGasto(false);
                  setFormMovimiento({
                    cantidad: 0,
                    descripcion: '',
                    justificacion: '',
                    referencia_externa: '',
                  });
                }}
                style={{ flex: 1 }}
              >
                ✕ Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TABLA DE MOVIMIENTOS */}
      <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '8px', border: '1px solid #3a4a5f' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#fff' }}>📊 Historial de Movimientos</h2>

        {movimientos.length === 0 ? (
          <p style={{ color: '#a1aec6', textAlign: 'center', padding: '1rem' }}>No hay movimientos registrados</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #3a4a5f' }}>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#a1aec6', fontWeight: 'bold' }}>Tipo</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#a1aec6', fontWeight: 'bold' }}>Fecha</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#a1aec6', fontWeight: 'bold' }}>Descripción</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: '#a1aec6', fontWeight: 'bold' }}>Cantidad</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: '#a1aec6', fontWeight: 'bold' }}>Saldo Anterior</th>
                  <th style={{ padding: '1rem', textAlign: 'right', color: '#a1aec6', fontWeight: 'bold' }}>Saldo Nuevo</th>
                  <th style={{ padding: '1rem', textAlign: 'left', color: '#a1aec6', fontWeight: 'bold' }}>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id} style={{ borderBottom: '1px solid #3a4a5f' }}>
                    <td style={{ padding: '1rem', color: mov.tipo === 'ingreso' ? '#52C41A' : '#FF4D4F', fontWeight: 'bold' }}>
                      {mov.tipo === 'ingreso' ? '⬇️ INGRESO' : '⬆️ GASTO'}
                    </td>
                    <td style={{ padding: '1rem', color: '#a1aec6', fontSize: '0.9rem' }}>
                      {formatearFecha(mov.creado_at)}
                    </td>
                    <td style={{ padding: '1rem', color: '#fff' }}>{mov.descripcion}</td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: mov.tipo === 'ingreso' ? '#52C41A' : '#FF4D4F', fontWeight: 'bold' }}>
                      ${mov.cantidad.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: '#a1aec6' }}>
                      ${mov.saldo_anterior.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right', color: '#fff', fontWeight: 'bold' }}>
                      ${mov.saldo_nuevo.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', color: '#a1aec6', fontSize: '0.9rem' }}>
                      {mov.referencia_externa || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
