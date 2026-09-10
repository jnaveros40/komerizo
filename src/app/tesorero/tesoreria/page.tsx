'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

interface Movimiento {
  id: number
  tipo: 'ingreso' | 'gasto'
  cantidad: number
  descripcion: string
  saldo_anterior: number
  saldo_nuevo: number
  referencia_externa: string | null
  creado_at: string
  fecha_movimiento?: string
}

interface SaldoInfo {
  saldo_actual: number
  saldo_anterior: number
}

export default function TesoreriaPage() {
  const { user } = useAuth()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [saldo, setSaldo] = useState<SaldoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const [{ data: movementRows, error: movementError }, { data: balance, error: balanceError }] = await Promise.all([
        supabase.from('komerizo_tesoreria').select('id,tipo,cantidad,descripcion,saldo_anterior,saldo_nuevo,referencia_externa,creado_at,fecha_movimiento').order('creado_at', { ascending: false }),
        supabase.from('komerizo_tesoreria_saldo').select('saldo_actual,saldo_anterior').order('fecha_actualizacion', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (movementError || balanceError) {
        setError((movementError || balanceError)?.message || 'No fue posible cargar la tesorería.')
      } else {
        setMovimientos(movementRows || [])
        setSaldo(balance)
      }
      setLoading(false)
    }
    loadData()
  }, [user?.id])

  const formatDate = (value: string) => new Date(value).toLocaleString('es-CO')

  if (loading) return <div style={{ padding: '2rem', color: '#fff' }}>Cargando tesorería...</div>
  if (error) return <div style={{ padding: '2rem', color: '#fff' }}><p>{error}</p></div>

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#fff' }}>Tesorería</h1>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <Link href="/tesorero/ingresos" style={{ display: 'inline-block', padding: '0.65rem 1rem', borderRadius: '6px', background: '#52C41A', color: '#102018', textDecoration: 'none', fontWeight: 600 }}>Registrar ingreso</Link>
        <Link href="/tesorero/egresos" style={{ display: 'inline-block', padding: '0.65rem 1rem', borderRadius: '6px', background: '#FF4D4F', color: '#fff', textDecoration: 'none', fontWeight: 600 }}>Revisar egresos</Link>
      </div>
      <p style={{ margin: '0 0 1.5rem', color: '#a1aec6' }}>Los movimientos oficiales aparecen aquí después de completar su flujo correspondiente.</p>
      <div style={{ background: 'linear-gradient(135deg, #6c5ce7 0%, #5f3dc4 100%)', padding: '2rem', borderRadius: '8px', marginBottom: '2rem', border: '1px solid #7c6ce7' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          <div><div style={{ color: 'rgba(255,255,255,0.8)' }}>Saldo anterior</div><strong style={{ fontSize: '1.8rem', color: '#fff' }}>${Number(saldo?.saldo_anterior || 0).toFixed(2)}</strong></div>
          <div style={{ textAlign: 'center' }}><div style={{ color: 'rgba(255,255,255,0.8)' }}>Saldo actual</div><strong style={{ fontSize: '2.5rem', color: '#fff' }}>${Number(saldo?.saldo_actual || 0).toFixed(2)}</strong></div>
          <div style={{ textAlign: 'right' }}><div style={{ color: 'rgba(255,255,255,0.8)' }}>Diferencia</div><strong style={{ fontSize: '1.8rem', color: (saldo?.saldo_actual || 0) >= (saldo?.saldo_anterior || 0) ? '#52C41A' : '#FF4D4F' }}>${((saldo?.saldo_actual || 0) - (saldo?.saldo_anterior || 0)).toFixed(2)}</strong></div>
        </div>
      </div>
      <div style={{ background: '#1e2a3a', padding: '2rem', borderRadius: '8px', border: '1px solid #3a4a5f' }}>
        <h2 style={{ marginBottom: '1.5rem', color: '#fff' }}>Historial de movimientos</h2>
        {movimientos.length === 0 ? <p style={{ color: '#a1aec6', textAlign: 'center' }}>No hay movimientos registrados.</p> : <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Tipo', 'Fecha', 'Descripción', 'Cantidad', 'Saldo anterior', 'Saldo nuevo', 'Referencia'].map(label => <th key={label} style={{ padding: '1rem', textAlign: 'left', color: '#a1aec6' }}>{label}</th>)}</tr></thead>
            <tbody>{movimientos.map(movement => <tr key={movement.id} style={{ borderBottom: '1px solid #3a4a5f' }}>
              <td style={{ padding: '1rem', color: movement.tipo === 'ingreso' ? '#52C41A' : '#FF4D4F' }}>{movement.tipo === 'ingreso' ? 'INGRESO' : 'GASTO'}</td>
              <td style={{ padding: '1rem', color: '#a1aec6' }}>{formatDate(movement.fecha_movimiento || movement.creado_at)}</td>
              <td style={{ padding: '1rem', color: '#fff' }}>{movement.descripcion}</td>
              <td style={{ padding: '1rem', color: '#fff' }}>${Number(movement.cantidad).toFixed(2)}</td>
              <td style={{ padding: '1rem', color: '#a1aec6' }}>${Number(movement.saldo_anterior).toFixed(2)}</td>
              <td style={{ padding: '1rem', color: '#fff' }}>${Number(movement.saldo_nuevo).toFixed(2)}</td>
              <td style={{ padding: '1rem', color: '#a1aec6' }}>{movement.referencia_externa || '-'}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </div>
    </div>
  )
}
