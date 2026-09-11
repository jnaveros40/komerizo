/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './tesoreria.css'

type Movimiento = {
  id: number; tipo: string; cantidad: number; descripcion: string; justificacion: string
  referencia_externa: string; archivo_adjunto_url?: string; estado: string
  fecha: string; hora: string; saldo_posterior: number; creador: string; rol: string
  fecha_movimiento?: string; beneficiario_destino?: string; metodo_pago?: string; origen_tipo?: string
}

const currency = (amount: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(Number(amount) || 0)
const originLabels: Record<string, string> = { manual: 'Otros ingresos', salon: 'Salón comunal', alquiler_recursos: 'Alquiler de recursos', alquiler_recursos_deposito: 'Depósito aplicado', donacion: 'Donación', cuota: 'Cuota', venta_producto: 'Venta de productos', bono_solidario: 'Bono solidario', bono_premio_no_entregado: 'Premio de bono no entregado' }

export default function UsuarioTesoreria() {
  const { user } = useAuth()
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [saldoDisponible, setSaldoDisponible] = useState(0)
  const [loading, setLoading] = useState(true)
  const [treasurerRoleId, setTreasurerRoleId] = useState<number | null>(null)
  const [pendingRequest, setPendingRequest] = useState(false)
  const [selected, setSelected] = useState<Movimiento | null>(null)
  const [message, setMessage] = useState('')
  const [selectedMonths, setSelectedMonths] = useState(6)
  const [statistics, setStatistics] = useState<any | null>(null)
  const [movementFilter, setMovementFilter] = useState<'todos' | 'ingreso' | 'gasto'>('todos')

  const fetchTesoreria = async () => {
    if (!user?.id) return
    try {
      setLoading(true)
      const [{ data: saldoData }, { data: role }, { data: movsData, error: movError }] = await Promise.all([
        supabase.from('komerizo_tesoreria_saldo').select('saldo_actual').order('fecha_actualizacion', { ascending: false }).limit(1).single(),
        supabase.from('komerizo_roles').select('id').eq('nombre', 'Tesorero').single(),
        supabase.from('komerizo_tesoreria').select('id,tipo,cantidad,descripcion,justificacion,referencia_externa,archivo_adjunto_url,estado,creado_at,fecha_movimiento,beneficiario_destino,metodo_pago,origen_tipo,saldo_nuevo,usuario_id,komerizo_usuarios(nombre,apellido),komerizo_roles(nombre)').eq('estado', 'registrado').order('fecha_movimiento', { ascending: false }).limit(50),
      ])
      if (saldoData) setSaldoDisponible(Number(saldoData.saldo_actual))
      if (role) {
        setTreasurerRoleId(role.id)
        const { data: requests } = await supabase.from('komerizo_solicitud_informes').select('id').eq('usuario_id', user.id).eq('destinatario_rol_id', role.id).neq('estado', 'Respondido')
        setPendingRequest(Boolean(requests?.length))
      }
      if (movError) throw movError
      setMovimientos((movsData || []).map((mov: any) => {
        const created = new Date(mov.creado_at)
        return {
          id: mov.id, tipo: mov.tipo, cantidad: mov.cantidad, descripcion: mov.descripcion,
          justificacion: mov.justificacion || '', referencia_externa: mov.referencia_externa || '',
          archivo_adjunto_url: mov.archivo_adjunto_url, estado: mov.estado,
          fecha_movimiento: mov.fecha_movimiento, beneficiario_destino: mov.beneficiario_destino,
          metodo_pago: mov.metodo_pago, origen_tipo: mov.origen_tipo,
          fecha: mov.fecha_movimiento ? new Date(`${mov.fecha_movimiento}T00:00:00`).toLocaleDateString('es-CO') : created.toLocaleDateString('es-CO'),
          hora: created.toLocaleTimeString('es-CO'), saldo_posterior: mov.saldo_nuevo,
          creador: mov.komerizo_usuarios ? `${mov.komerizo_usuarios.nombre} ${mov.komerizo_usuarios.apellido}` : 'Desconocido',
          rol: mov.komerizo_roles?.nombre || 'Tesorero',
        }
      }))
    } catch (error) { console.error('Error cargando tesorería:', error) }
    finally { setLoading(false) }
  }

  const loadStatistics = async () => {
    const { data, error } = await supabase.rpc('komerizo_estadisticas_financieras', { p_meses: selectedMonths })
    if (!error) setStatistics(data)
  }

  useEffect(() => { fetchTesoreria(); loadStatistics() }, [user?.id, selectedMonths])

  const requestReport = async () => {
    if (!user?.id || !treasurerRoleId || !selected || !message.trim()) { alert('Escribe la información que deseas solicitar.'); return }
    const { error } = await supabase.from('komerizo_solicitud_informes').insert({ usuario_id: user.id, destinatario_rol_id: treasurerRoleId, destinatario_id: 0, mensaje_solicitud: message.trim(), mensaje_respuesta: 'Pendiente de respuesta', estado: 'Pendiente', movimiento_tesoreria_id: selected.id })
    if (error) { alert(error.message); return }
    setSelected(null); setMessage(''); setPendingRequest(true); alert('Solicitud enviada al Tesorero.')
  }

  const visibleMovimientos = movementFilter === 'todos'
    ? movimientos
    : movimientos.filter(mov => mov.tipo === movementFilter)

  return <div className="tesoreria-container">
    <div className="tesoreria-header"><h1>💰 Transparencia Financiera</h1><p className="header-subtitle">Consulta los movimientos oficiales de la JAC</p></div>
    <div className="saldo-card"><h3>Saldo Disponible de la JAC</h3><h2 className="saldo-amount">{currency(saldoDisponible)}</h2><p className="saldo-note">Última actualización: {new Date().toLocaleDateString('es-CO')}</p></div>
    {statistics && <section className="estadisticas-section"><div className="statistics-heading"><h2>Estadísticas financieras</h2><select value={selectedMonths} onChange={event => setSelectedMonths(Number(event.target.value))}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option></select></div><div className="statistics-cards"><div><span>Saldo actual</span><strong>{currency(statistics.saldo_actual)}</strong></div><div><span>Ingresos del periodo</span><strong>{currency(statistics.total_ingresos_periodo)}</strong></div><div><span>Egresos del periodo</span><strong>{currency(statistics.total_egresos_periodo)}</strong></div><div><span>Resultado del periodo</span><strong>{currency(statistics.resultado_periodo)}</strong></div></div><div className="comparison-card"><h3>Mes actual vs mes anterior</h3><p>Ingresos actuales: {currency(statistics.mes_actual?.ingresos)} · Ingresos anteriores: {currency(statistics.mes_anterior?.ingresos)} · Variación: {statistics.variacion_ingresos_porcentaje === null ? 'Sin base de comparación' : `${statistics.variacion_ingresos_porcentaje}%`}</p><p>Egresos actuales: {currency(statistics.mes_actual?.egresos)} · Egresos anteriores: {currency(statistics.mes_anterior?.egresos)} · Variación: {statistics.variacion_egresos_porcentaje === null ? 'Sin base de comparación' : `${statistics.variacion_egresos_porcentaje}%`}</p></div><div className="monthly-bars"><h3>Comparación mensual</h3>{(statistics.mensual || []).map((month: any) => { const max = Math.max(...(statistics.mensual || []).flatMap((item: any) => [Number(item.ingresos) || 0, Number(item.egresos) || 0]), 1); return <div className="month-row" key={month.mes}><b>{month.mes}</b><div><span>Ingresos {currency(month.ingresos)}</span><i style={{ width: `${(Number(month.ingresos) || 0) / max * 100}%` }} /></div><div><span>Egresos {currency(month.egresos)}</span><i className="expense-bar" style={{ width: `${(Number(month.egresos) || 0) / max * 100}%` }} /></div></div> })}</div><div className="breakdown-grid"><div><h3>Principales fuentes de ingreso</h3>{(statistics.origenes_ingreso || []).map((item: any) => <p key={item.origen}><span>{originLabels[item.origen] || item.origen}</span><b>{currency(item.total)}</b></p>)}</div><div><h3>Principales egresos</h3>{(statistics.principales_egresos || []).map((item: any) => <p key={item.concepto}><span>{item.concepto}</span><b>{currency(item.total)}</b></p>)}</div></div></section>}
    <div className="movimientos-section"><h2>Últimos movimientos registrados</h2>
      <div className="movement-filters" role="group" aria-label="Filtrar movimientos"><button className={movementFilter === 'todos' ? 'active' : ''} onClick={() => setMovementFilter('todos')}>Todos</button><button className={movementFilter === 'ingreso' ? 'active' : ''} onClick={() => setMovementFilter('ingreso')}>Ingresos</button><button className={movementFilter === 'gasto' ? 'active' : ''} onClick={() => setMovementFilter('gasto')}>Egresos</button></div>
      {loading ? <div className="loading">Cargando movimientos financieros...</div> : visibleMovimientos.length === 0 ? <div className="empty-state">No hay movimientos financieros registrados.</div> : <div className="table-responsive"><table className="movimientos-table"><thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Concepto</th><th>Origen</th><th>Beneficiario</th><th>Responsable</th><th>Monto</th><th>Soporte</th><th>Informe</th></tr></thead><tbody>{visibleMovimientos.map(mov => <tr key={mov.id}><td><div className="td-datetime"><span className="td-date">{mov.fecha}</span><span className="td-time">{mov.hora}</span></div></td><td><span className={`badge-tipo ${mov.tipo}`}>{mov.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</span></td><td><div className="td-concepto"><strong>{mov.descripcion}</strong>{mov.justificacion && <span className="td-justificacion">{mov.justificacion}</span>}</div></td><td>{mov.origen_tipo ? (originLabels[mov.origen_tipo] || mov.origen_tipo) : '-'}</td><td>{mov.beneficiario_destino || '-'}</td><td><span className="td-rol">{mov.rol}</span></td><td className={`td-monto ${mov.tipo}`}>{mov.tipo === 'gasto' ? '-' : '+'}{currency(mov.cantidad)}</td><td>{mov.archivo_adjunto_url ? <a href={mov.archivo_adjunto_url} target="_blank" rel="noreferrer" className="btn-comprobante">📄 Ver</a> : mov.referencia_externa || 'N/A'}</td><td>{mov.tipo === 'gasto' && <button className="btn-comprobante" disabled={pendingRequest} onClick={() => setSelected(mov)}>Solicitar informe</button>}</td></tr>)}</tbody></table></div>}
      {pendingRequest && <p className="pending-request">Ya tienes una solicitud pendiente al Tesorero. Debe ser respondida antes de solicitar información sobre otro egreso.</p>}
    </div>
    {selected && <div className="request-modal"><div className="request-modal-card"><h2>Solicitar informe del egreso #{selected.id}</h2><p><b>Fecha:</b> {selected.fecha}</p><p><b>Concepto:</b> {selected.descripcion}</p><p><b>Monto:</b> {currency(selected.cantidad)}</p><label>¿Qué información deseas solicitar sobre este egreso?<textarea value={message} onChange={event => setMessage(event.target.value)} autoFocus required /></label><div className="request-actions"><button onClick={requestReport} disabled={!message.trim()}>Enviar solicitud</button><button onClick={() => { setSelected(null); setMessage('') }}>Cancelar</button></div></div></div>}
  </div>
}
