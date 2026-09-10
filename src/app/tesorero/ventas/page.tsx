/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { downloadProductSaleVoucher, downloadProductSalesReport } from '@/lib/financialReceipts'
import './ventas.css'

type Tab = 'actividades' | 'registrar' | 'buscar'
type Sale = any
const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)
const paymentMethods = ['Efectivo', 'Transferencia', 'Cheque', 'Otro']

export default function TesoreroVentasPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('actividades')
  const [roleId, setRoleId] = useState<number | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [selectedActivityId, setSelectedActivityId] = useState<number | null>(null)
  const [selectedExpenses, setSelectedExpenses] = useState<number[]>([])
  const [activityForm, setActivityForm] = useState({ nombre: '', producto: '', descripcion: '', cantidad: '', precio: '', entrega: '' })
  const [buyerType, setBuyerType] = useState<'afiliado' | 'externo'>('externo')
  const [buyer, setBuyer] = useState({ id: null as number | null, documento: '', nombre: '', celular: '', correo: '' })
  const [saleForm, setSaleForm] = useState({ cantidad: '1', estado: 'reservada', metodo: 'Efectivo' })
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<{ sale: Sale; type: 'pago' | 'reserva' | 'pendiente_pago' } | null>(null)
  const [searchDocument, setSearchDocument] = useState('')
  const [searchResults, setSearchResults] = useState<Sale[]>([])
  const [paymentModal, setPaymentModal] = useState<{ sale: Sale; mode: 'pagar_reserva' | 'cobrar_pendiente' } | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')

  const loadData = async () => {
    if (!user?.id) return
    const [{ data: role }, { data: rows }, { data: expenseRows }] = await Promise.all([
      supabase.from('komerizo_roles').select('id').eq('nombre', 'Tesorero').single(),
      supabase.from('komerizo_actividades_venta').select('*,komerizo_ventas_actividad(*)').order('fecha_entrega'),
      supabase.from('komerizo_tesoreria').select('id,fecha_movimiento,descripcion,cantidad').eq('tipo', 'gasto').eq('estado', 'registrado').order('fecha_movimiento', { ascending: false }),
    ])
    if (role) setRoleId(role.id)
    setActivities(rows || []); setExpenses(expenseRows || [])
  }
  useEffect(() => { loadData() }, [user?.id])
  const openActivities = useMemo(() => activities.filter(activity => activity.estado === 'abierta'), [activities])
  const selectedActivity = activities.find(activity => activity.id === selectedActivityId) || null
  const selectedSales: Sale[] = selectedActivity?.komerizo_ventas_actividad || []
  const selectedExpenseTotal = selectedExpenses.reduce((total, id) => total + Number(expenses.find(expense => expense.id === id)?.cantidad || 0), 0)

  const createActivity = async (event: FormEvent) => {
    event.preventDefault(); if (!user?.id || !roleId || selectedExpenses.length === 0) { alert('Selecciona al menos un egreso registrado.'); return }
    setBusy(true)
    const { error } = await supabase.rpc('komerizo_crear_actividad_venta', { p_nombre: activityForm.nombre, p_producto_nombre: activityForm.producto, p_descripcion: activityForm.descripcion, p_cantidad_inicial: Number(activityForm.cantidad), p_precio_unitario: Number(activityForm.precio), p_fecha_entrega: activityForm.entrega, p_egresos: selectedExpenses, p_tesorero_id: user.id, p_tesorero_rol_id: roleId })
    setBusy(false); if (error) { alert(error.message); return }; setActivityForm({ nombre: '', producto: '', descripcion: '', cantidad: '', precio: '', entrega: '' }); setSelectedExpenses([]); await loadData()
  }
  const closeActivity = async (activity: any) => {
    if (!user?.id || !roleId || !confirm('Cerrar esta actividad?')) return; setBusy(true)
    const { error } = await supabase.rpc('komerizo_cerrar_actividad_venta', { p_actividad_id: activity.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); setBusy(false); if (error) alert(error.message); else await loadData()
  }
  const lookupBuyer = async () => {
    if (!buyer.documento.trim()) return; const { data } = await supabase.from('komerizo_usuarios').select('id,cc,nombre,apellido,telefono,correo_electronico').eq('cc', buyer.documento.trim()).maybeSingle()
    if (!data) { alert('No se encontro un afiliado con ese documento.'); return }; setBuyer({ id: data.id, documento: data.cc, nombre: `${data.nombre} ${data.apellido || ''}`.trim(), celular: data.telefono || '', correo: data.correo_electronico || '' })
  }
  const registerSale = async (event: FormEvent) => {
    event.preventDefault(); if (!user?.id || !roleId || !selectedActivityId) { alert('Selecciona una actividad abierta.'); return }; if (buyerType === 'afiliado' && !buyer.id) { alert('Busca primero el afiliado por CC.'); return }
    setBusy(true); const { data: saleId, error } = await supabase.rpc('komerizo_registrar_venta_producto', { p_actividad_id: selectedActivityId, p_comprador_usuario_id: buyerType === 'afiliado' ? buyer.id : null, p_numero_documento: buyer.documento, p_nombre_comprador: buyer.nombre, p_celular: buyer.celular, p_correo: buyer.correo, p_cantidad: Number(saleForm.cantidad), p_estado_inicial: saleForm.estado, p_metodo_pago: saleForm.estado === 'pagada' ? saleForm.metodo : null, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); setBusy(false)
    if (error) { alert(error.message); return }; const activity = activities.find(item => item.id === selectedActivityId); const { data: savedSale } = await supabase.from('komerizo_ventas_actividad').select('*').eq('id', saleId).single()
    setReceipt({ sale: { ...(savedSale || { id: saleId, nombre_comprador: buyer.nombre, numero_documento: buyer.documento, cantidad: Number(saleForm.cantidad), precio_unitario: activity?.precio_unitario, total: Number(saleForm.cantidad) * Number(activity?.precio_unitario || 0), estado: saleForm.estado }), actividad_nombre: activity?.nombre, producto_nombre: activity?.producto_nombre, fecha_entrega: activity?.fecha_entrega }, type: saleForm.estado === 'pagada' ? 'pago' : 'reserva' }); setBuyer({ id: null, documento: '', nombre: '', celular: '', correo: '' }); await loadData()
  }
  const transition = async (sale: Sale, action: 'pay' | 'collect' | 'pending' | 'cancel') => {
    if (!user?.id || !roleId) return; if (action === 'pay' || action === 'collect') { setPaymentMethod('Efectivo'); setPaymentModal({ sale, mode: action === 'pay' ? 'pagar_reserva' : 'cobrar_pendiente' }); return }; if (action === 'pending' && !confirm('Marcar esta reserva como pendiente de pago?')) return; if (action === 'cancel' && !confirm('Cancelar esta reserva?')) return
    setBusy(true); const result = action === 'pending' ? await supabase.rpc('komerizo_marcar_producto_pendiente_pago', { p_venta_id: sale.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }) : await supabase.rpc('komerizo_cancelar_reserva_producto', { p_venta_id: sale.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); setBusy(false)
    if (result.error) { alert(result.error.message); return }; if (action === 'pending') { const activity = activities.find(item => item.id === sale.actividad_id) || sale.komerizo_actividades_venta; setReceipt({ sale: { ...sale, estado: 'pendiente_pago', actividad_nombre: activity?.nombre, producto_nombre: activity?.producto_nombre, fecha_entrega: activity?.fecha_entrega }, type: 'pendiente_pago' }) }; await loadData()
  }
  const confirmPayment = async () => {
    if (!paymentModal || !user?.id || !roleId) return; setBusy(true)
    const result = paymentModal.mode === 'pagar_reserva' ? await supabase.rpc('komerizo_pagar_reserva_producto', { p_venta_id: paymentModal.sale.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId, p_metodo_pago: paymentMethod }) : await supabase.rpc('komerizo_cobrar_venta_pendiente', { p_venta_id: paymentModal.sale.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId, p_metodo_pago: paymentMethod }); setBusy(false)
    if (result.error) { alert(result.error.message); return }; const activity = activities.find(item => item.id === paymentModal.sale.actividad_id) || paymentModal.sale.komerizo_actividades_venta; setReceipt({ sale: { ...paymentModal.sale, estado: 'pagada', metodo_pago: paymentMethod, tesoreria_movimiento_id: result.data, fecha_pago: new Date().toISOString(), actividad_nombre: activity?.nombre, producto_nombre: activity?.producto_nombre, fecha_entrega: activity?.fecha_entrega }, type: 'pago' }); setPaymentModal(null); await loadData()
  }
  const search = async (event: FormEvent) => { event.preventDefault(); const { data, error } = await supabase.from('komerizo_ventas_actividad').select('*,komerizo_actividades_venta(nombre,producto_nombre,fecha_entrega)').eq('numero_documento', searchDocument.trim()).order('fecha_registro', { ascending: false }); if (error) alert(error.message); else setSearchResults(data || []) }
  const saleVoucher = (sale: Sale) => { const activity = sale.komerizo_actividades_venta || activities.find(item => item.id === sale.actividad_id) || selectedActivity; downloadProductSaleVoucher({ ...sale, actividad_nombre: activity?.nombre, producto_nombre: activity?.producto_nombre, fecha_entrega: activity?.fecha_entrega }, sale.estado === 'pagada' ? 'pago' : sale.estado === 'reservada' ? 'reserva' : 'pendiente_pago') }

  return <main className="ventas-page"><h1>Ventas de productos</h1><nav className="ventas-tabs"><button className={tab === 'actividades' ? 'active' : ''} onClick={() => setTab('actividades')}>Actividades</button><button className={tab === 'registrar' ? 'active' : ''} onClick={() => setTab('registrar')}>Registrar venta</button><button className={tab === 'buscar' ? 'active' : ''} onClick={() => setTab('buscar')}>Buscar comprobante</button></nav>
    {tab === 'actividades' && <><section className="ventas-card"><h2>Nueva actividad</h2><form onSubmit={createActivity} className="ventas-form"><label>Nombre de la actividad<input required value={activityForm.nombre} onChange={e => setActivityForm({ ...activityForm, nombre: e.target.value })} /></label><label>Producto<input required value={activityForm.producto} onChange={e => setActivityForm({ ...activityForm, producto: e.target.value })} /></label><label>Descripcion<textarea value={activityForm.descripcion} onChange={e => setActivityForm({ ...activityForm, descripcion: e.target.value })} /></label><label>Cantidad inicial<input required type="number" min="1" value={activityForm.cantidad} onChange={e => setActivityForm({ ...activityForm, cantidad: e.target.value })} /></label><label>Precio unitario<input required type="number" min="0.01" step="0.01" value={activityForm.precio} onChange={e => setActivityForm({ ...activityForm, precio: e.target.value })} /></label><label>Fecha de entrega<input required type="date" value={activityForm.entrega} onChange={e => setActivityForm({ ...activityForm, entrega: e.target.value })} /></label><fieldset><legend>Egresos asociados</legend>{expenses.map(expense => <label key={expense.id} className="check"><input type="checkbox" checked={selectedExpenses.includes(expense.id)} onChange={e => setSelectedExpenses(e.target.checked ? [...selectedExpenses, expense.id] : selectedExpenses.filter(id => id !== expense.id))} /> #{expense.id} · {expense.fecha_movimiento} · {expense.descripcion} · {money(expense.cantidad)}</label>)}<b>Total: {money(selectedExpenseTotal)}</b></fieldset><button disabled={busy}>Crear actividad</button></form></section><section className="ventas-card"><h2>Actividades</h2>{activities.map(activity => { const sales: Sale[] = activity.komerizo_ventas_actividad || []; const units = (state: string) => sales.filter(sale => sale.estado === state).reduce((sum, sale) => sum + Number(sale.cantidad), 0); const available = Number(activity.cantidad_inicial) - units('pagada') - units('reservada') - units('pendiente_pago'); return <article key={activity.id} className="activity-card"><div><h3>{activity.nombre}</h3><p>{activity.producto_nombre} · Entrega: {activity.fecha_entrega}</p><p>Inicial: {activity.cantidad_inicial} · Precio: {money(activity.precio_unitario)} · Disponibles: {available}</p><p>Pagadas: {units('pagada')} · Reservadas: {units('reservada')} · Pendientes: {units('pendiente_pago')}</p><b>Estado: {activity.estado}</b></div><div className="ventas-actions">{activity.estado === 'abierta' && <><button onClick={() => setSelectedActivityId(activity.id)}>Gestionar ventas</button><button onClick={() => closeActivity(activity)} disabled={busy}>Cerrar actividad</button></>}{activity.estado === 'cerrada' && <button onClick={() => downloadProductSalesReport(activity)}>Descargar reporte</button>}</div></article> })}</section>{selectedActivity && <section className="ventas-card"><h2>Ventas de {selectedActivity.nombre}</h2>{selectedSales.map(sale => <SaleRow key={sale.id} sale={sale} onVoucher={saleVoucher} onTransition={transition} busy={busy} />)}</section>}</>}
    {tab === 'registrar' && <section className="ventas-card"><h2>Registrar venta</h2><label>Actividad abierta<select value={selectedActivityId || ''} onChange={e => setSelectedActivityId(Number(e.target.value) || null)}><option value="">Selecciona una actividad</option>{openActivities.map(activity => <option key={activity.id} value={activity.id}>{activity.nombre} · {activity.producto_nombre}</option>)}</select></label><form onSubmit={registerSale} className="ventas-form"><label>Tipo de comprador<select value={buyerType} onChange={e => { setBuyerType(e.target.value as 'afiliado' | 'externo'); setBuyer({ id: null, documento: '', nombre: '', celular: '', correo: '' }) }}><option value="afiliado">Afiliado</option><option value="externo">Externo</option></select></label><label>Documento<input required value={buyer.documento} onChange={e => setBuyer({ ...buyer, documento: e.target.value, id: null })} />{buyerType === 'afiliado' && <button type="button" onClick={lookupBuyer}>Buscar CC</button>}</label><label>Nombre<input required value={buyer.nombre} onChange={e => setBuyer({ ...buyer, nombre: e.target.value })} /></label><label>Celular<input value={buyer.celular} onChange={e => setBuyer({ ...buyer, celular: e.target.value })} /></label><label>Correo<input type="email" value={buyer.correo} onChange={e => setBuyer({ ...buyer, correo: e.target.value })} /></label><label>Cantidad<input required type="number" min="1" value={saleForm.cantidad} onChange={e => setSaleForm({ ...saleForm, cantidad: e.target.value })} /></label><label>Estado inicial<select value={saleForm.estado} onChange={e => setSaleForm({ ...saleForm, estado: e.target.value })}><option value="pagada">Pagada</option><option value="reservada">Reservada</option></select></label>{saleForm.estado === 'pagada' && <label>Metodo de pago<select value={saleForm.metodo} onChange={e => setSaleForm({ ...saleForm, metodo: e.target.value })}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></label>}<button disabled={busy}>Registrar venta</button></form>{receipt && <button onClick={() => downloadProductSaleVoucher(receipt.sale, receipt.type)}>Descargar comprobante</button>}</section>}
    {tab === 'buscar' && <section className="ventas-card"><h2>Buscar comprobante</h2><form onSubmit={search} className="search-form"><label>Numero de documento<input value={searchDocument} onChange={e => setSearchDocument(e.target.value)} required /></label><button>Buscar</button></form>{searchResults.map(sale => <SaleRow key={sale.id} sale={sale} onVoucher={saleVoucher} onTransition={transition} busy={busy} />)}</section>}
    {paymentModal && <div className="payment-modal"><div className="payment-modal-card"><h2>{paymentModal.mode === 'pagar_reserva' ? 'Registrar pago de reserva' : 'Registrar pago pendiente'}</h2><p>Venta #{paymentModal.sale.id} · {money(paymentModal.sale.total)}</p><label>Metodo de pago<select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value)}>{paymentMethods.map(method => <option key={method}>{method}</option>)}</select></label><div className="ventas-actions"><button onClick={confirmPayment} disabled={busy}>Confirmar pago</button><button onClick={() => setPaymentModal(null)} disabled={busy}>Cancelar</button></div></div></div>}
  </main>
}

function SaleRow({ sale, onVoucher, onTransition, busy }: { sale: Sale; onVoucher: (sale: Sale) => void; onTransition: (sale: Sale, action: 'pay' | 'collect' | 'pending' | 'cancel') => void; busy: boolean }) {
  return <article className="sale-row"><div><b>#{sale.id} · {sale.nombre_comprador}</b><span>Documento: {sale.numero_documento} · Cantidad: {sale.cantidad} · Total: {money(sale.total)}</span><span>Estado: {sale.estado} · Fecha: {(sale.fecha_registro || '').slice(0, 10)}</span></div><div className="ventas-actions">{sale.estado === 'reservada' && <><button onClick={() => onTransition(sale, 'pay')} disabled={busy}>Registrar pago</button><button onClick={() => onTransition(sale, 'pending')} disabled={busy}>Reclama sin pagar</button><button onClick={() => onTransition(sale, 'cancel')} disabled={busy}>Cancelar</button><button onClick={() => onVoucher(sale)}>Comprobante reserva</button></>}{sale.estado === 'pagada' && <button onClick={() => onVoucher(sale)}>Reimprimir comprobante de pago</button>}{sale.estado === 'pendiente_pago' && <><button onClick={() => onTransition(sale, 'collect')} disabled={busy}>Registrar pago pendiente</button><button onClick={() => onVoucher(sale)}>Reimprimir comprobante pendiente</button></>}{sale.estado === 'cancelada' && <span>Sin acciones de pago</span>}</div></article>
}
