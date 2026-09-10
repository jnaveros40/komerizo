/* eslint-disable react-hooks/set-state-in-effect */
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { downloadProductSaleVoucher } from '@/lib/financialReceipts'
import './tienda.css'

type Actividad = {
  id: number
  nombre: string
  producto_nombre: string
  descripcion: string | null
  fecha_entrega: string
  precio_unitario: number
  cantidad_disponible: number
}

type Compra = {
  id: number
  numero_documento: string
  nombre_comprador: string
  cantidad: number
  precio_unitario: number
  total: number
  estado: 'pagada' | 'reservada' | 'pendiente_pago' | 'cancelada'
  fecha_registro: string
  fecha_pago: string | null
  metodo_pago: string | null
  tesoreria_movimiento_id: number | null
  komerizo_actividades_venta: Pick<Actividad, 'nombre' | 'producto_nombre' | 'fecha_entrega'> | null
}

const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)

export default function UsuarioTienda() {
  const { user } = useAuth()
  const [actividades, setActividades] = useState<Actividad[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    const [{ data: activityData, error: activityError }, { data: purchaseData, error: purchaseError }] = await Promise.all([
      supabase.rpc('komerizo_listar_actividades_venta'),
      supabase.from('komerizo_ventas_actividad').select('*,komerizo_actividades_venta(nombre,producto_nombre,fecha_entrega)').eq('comprador_usuario_id', user.id).order('fecha_registro', { ascending: false }),
    ])
    if (activityError) console.error('Error cargando actividades:', activityError)
    if (purchaseError) console.error('Error cargando reservas:', purchaseError)
    setActividades(activityData || [])
    setCompras(purchaseData || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user?.id])

  const reserve = async (activity: Actividad) => {
    if (!user?.id) return
    const quantity = cantidades[activity.id] || 1
    setBusy(activity.id)
    const { error } = await supabase.rpc('komerizo_reservar_producto_afiliado', {
      p_actividad_id: activity.id,
      p_usuario_id: user.id,
      p_cantidad: quantity,
    })
    setBusy(null)
    if (error) { alert(error.message); return }
    alert('Reserva realizada. Debes realizar el pago con el Tesorero para obtener el comprobante de pago.')
    await loadData()
  }

  const voucher = (purchase: Compra) => {
    const activity = purchase.komerizo_actividades_venta
    downloadProductSaleVoucher({ ...purchase, actividad_nombre: activity?.nombre, producto_nombre: activity?.producto_nombre }, purchase.estado === 'pagada' ? 'pago' : purchase.estado === 'reservada' ? 'reserva' : 'pendiente_pago')
  }

  return (
    <div className="tienda-container">
      <div className="tienda-header">
        <h1>🛍️ Actividades de venta</h1>
        <p className="header-subtitle">Reserva productos y realiza el pago con el Tesorero.</p>
      </div>
      {loading ? <div className="loading">Cargando actividades...</div> : (
        <>
          <section className="productos-section">
            <h2>Actividades disponibles</h2>
            {actividades.length === 0 ? <div className="empty-state">No hay actividades abiertas en este momento.</div> : (
              <div className="productos-list">
                {actividades.map(activity => (
                  <div key={activity.id} className="producto-card">
                    <div className="producto-info">
                      <h3>{activity.nombre}</h3>
                      <p className="producto-desc"><b>{activity.producto_nombre}</b>{activity.descripcion ? ` · ${activity.descripcion}` : ''}</p>
                      <div className="producto-meta">
                        <span className="producto-precio">{money(activity.precio_unitario)}</span>
                        <span>Entrega: {activity.fecha_entrega}</span>
                        <span className="producto-stock">Disponibles: {activity.cantidad_disponible}</span>
                      </div>
                    </div>
                    <div>
                      <select value={cantidades[activity.id] || 1} onChange={e => setCantidades({ ...cantidades, [activity.id]: Number(e.target.value) })} disabled={activity.cantidad_disponible <= 0}>
                        {Array.from({ length: Math.max(0, Number(activity.cantidad_disponible)) }, (_, index) => index + 1).map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                      <button className="btn-add" onClick={() => reserve(activity)} disabled={busy === activity.id || activity.cantidad_disponible <= 0}>{busy === activity.id ? 'Reservando...' : 'Reservar'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          <section className="carrito-section">
            <h2>Mis compras y reservas</h2>
            {compras.length === 0 ? <p className="carrito-vacio">Aún no tienes compras ni reservas.</p> : compras.map(purchase => (
              <article key={purchase.id} className="carrito-item">
                <div className="item-details">
                  <span className="item-name">{purchase.komerizo_actividades_venta?.producto_nombre || 'Producto'}</span>
                  <span>Actividad: {purchase.komerizo_actividades_venta?.nombre || '-'}</span>
                  <span>Entrega: {purchase.komerizo_actividades_venta?.fecha_entrega || '-'}</span>
                  <span>Cantidad: {purchase.cantidad} · {money(purchase.total)} · {purchase.estado}</span>
                </div>
                {purchase.estado !== 'cancelada' && <button className="btn-add" onClick={() => voucher(purchase)}>Descargar comprobante</button>}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  )
}
