'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import './tesoreria.css'

type Movimiento = {
  id: number
  tipo: string
  cantidad: number
  descripcion: string
  justificacion: string
  referencia_externa: string
  estado: string
  fecha: string
  hora: string
  saldo_posterior: number
  creador: string
  rol: string
}

export default function UsuarioTesoreria() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [saldoDisponible, setSaldoDisponible] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTesoreria()
  }, [])

  const fetchTesoreria = async () => {
    try {
      setLoading(true)
      
      // Obtener saldo actual
      const { data: saldoData, error: errSaldo } = await supabase
        .from('komerizo_tesoreria_saldo')
        .select('saldo_actual')
        .order('fecha_actualizacion', { ascending: false })
        .limit(1)
        .single()

      if (!errSaldo && saldoData) {
        setSaldoDisponible(saldoData.saldo_actual)
      }

      // Obtener últimos movimientos (solo los registrados oficiales)
      const { data: movsData, error: errMovs } = await supabase
        .from('komerizo_tesoreria')
        .select(`
          id,
          tipo,
          cantidad,
          descripcion,
          justificacion,
          referencia_externa,
          estado,
          creado_at,
          saldo_nuevo,
          komerizo_usuarios (nombre, apellido),
          komerizo_usuario_roles (komerizo_roles (nombre))
        `)
        .eq('estado', 'registrado')
        .order('creado_at', { ascending: false })
        .limit(50)

      if (errMovs) throw errMovs

      const formatMovs: Movimiento[] = (movsData || []).map((mov: any) => {
        const dateObj = new Date(mov.creado_at)
        return {
          id: mov.id,
          tipo: mov.tipo,
          cantidad: mov.cantidad,
          descripcion: mov.descripcion,
          justificacion: mov.justificacion || '',
          referencia_externa: mov.referencia_externa || '',
          estado: mov.estado,
          fecha: dateObj.toLocaleDateString(),
          hora: dateObj.toLocaleTimeString(),
          saldo_posterior: mov.saldo_nuevo,
          creador: mov.komerizo_usuarios ? `${mov.komerizo_usuarios.nombre} ${mov.komerizo_usuarios.apellido}` : 'Desconocido',
          rol: mov.komerizo_usuario_roles?.komerizo_roles?.nombre || 'Tesorero'
        }
      })

      setMovimientos(formatMovs)
    } catch (error) {
      console.error('Error cargando tesorería:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount)
  }

  return (
    <div className="tesoreria-container">
      <div className="tesoreria-header">
        <h1>💰 Transparencia Financiera</h1>
        <p className="header-subtitle">Consulta el estado financiero y movimientos de la JAC</p>
      </div>

      <div className="saldo-card">
        <h3>Saldo Disponible de la JAC</h3>
        <h2 className="saldo-amount">{formatCurrency(saldoDisponible)}</h2>
        <p className="saldo-note">Última actualización: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="movimientos-section">
        <h2>Últimos Movimientos</h2>
        
        {loading ? (
          <div className="loading">Cargando movimientos financieros...</div>
        ) : movimientos.length === 0 ? (
          <div className="empty-state">No hay movimientos financieros registrados.</div>
        ) : (
          <div className="table-responsive">
            <table className="movimientos-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Tipo</th>
                  <th>Concepto</th>
                  <th>Responsable</th>
                  <th>Monto</th>
                  <th>Comprobante</th>
                </tr>
              </thead>
              <tbody>
                {movimientos.map((mov) => (
                  <tr key={mov.id}>
                    <td>
                      <div className="td-datetime">
                        <span className="td-date">{mov.fecha}</span>
                        <span className="td-time">{mov.hora}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge-tipo ${mov.tipo}`}>
                        {mov.tipo.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <div className="td-concepto">
                        <strong>{mov.descripcion}</strong>
                        {mov.justificacion && <span className="td-justificacion">{mov.justificacion}</span>}
                      </div>
                    </td>
                    <td>
                      <div className="td-responsable">
                        <span className="td-rol">{mov.rol}</span>
                      </div>
                    </td>
                    <td className={`td-monto ${mov.tipo}`}>
                      {mov.tipo === 'gasto' ? '-' : '+'}{formatCurrency(mov.cantidad)}
                    </td>
                    <td>
                      {mov.referencia_externa ? (
                        <a href={mov.referencia_externa} target="_blank" rel="noopener noreferrer" className="btn-comprobante">
                          📄 Ver
                        </a>
                      ) : (
                        <span className="no-comprobante">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
