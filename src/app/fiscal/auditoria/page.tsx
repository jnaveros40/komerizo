'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './auditoria.css'

const currency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)

export default function FiscalAuditoriaPage() {
  const { user } = useAuth()
  const [roleId, setRoleId] = useState<number | null>(null)
  const [tab, setTab] = useState<'alertas' | 'registrados'>('alertas')
  const [alerts, setAlerts] = useState<any[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ kind: 'alert' | 'movement'; item: any } | null>(null)
  const [comment, setComment] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const loadData = async () => {
    setLoading(true)
    const { data: fiscalRole } = await supabase.from('komerizo_roles').select('id').eq('nombre', 'Fiscal').single()
    if (fiscalRole) setRoleId(fiscalRole.id)
    const [{ data: alertRows }, { data: movementRows }] = await Promise.all([
      supabase.from('komerizo_alertas_fiscales').select('*').order('created_at', { ascending: false }),
      supabase.from('komerizo_tesoreria').select('*').eq('tipo', 'gasto').eq('estado', 'registrado').order('fecha_movimiento', { ascending: false }),
    ])
    const authIds = [...new Set([...(alertRows || []).map(row => row.autorizacion_gasto_id), ...(movementRows || []).map(row => row.autorizacion_gasto_id)].filter(Boolean))]
    const movementIds = [...new Set([...(alertRows || []).map(row => row.movimiento_tesoreria_id), ...(movementRows || []).map(row => row.id)].filter(Boolean))]
    const [{ data: auths }, { data: linkedMovements }, { data: history }] = await Promise.all([
      authIds.length ? supabase.from('komerizo_autorizaciones_gasto').select('*').in('id', authIds) : Promise.resolve({ data: [] }),
      movementIds.length ? supabase.from('komerizo_tesoreria').select('*').in('id', movementIds) : Promise.resolve({ data: [] }),
      authIds.length ? supabase.from('komerizo_autorizaciones_gasto_historial').select('*').in('autorizacion_id', authIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
    ])
    const peopleIds = [...new Set([...(alertRows || []).map(row => row.creada_por), ...(auths || []).map((row: any) => row.solicitante_id), ...(auths || []).map((row: any) => row.tesorero_id), ...(linkedMovements || []).map(row => row.usuario_id)].filter(Boolean))]
    const { data: people } = peopleIds.length ? await supabase.from('komerizo_usuarios').select('id,nombre,apellido').in('id', peopleIds) : { data: [] }
    const authMap = Object.fromEntries((auths || []).map(row => [row.id, row]))
    const movementMap = Object.fromEntries((linkedMovements || []).map(row => [row.id, row]))
    const peopleMap = Object.fromEntries((people || []).map(row => [row.id, `${row.nombre} ${row.apellido}`]))
    const historyMap: Record<string, any[]> = {}
    ;(history || []).forEach(row => { (historyMap[row.autorizacion_id] ||= []).push(row) })
    setAlerts((alertRows || []).map(row => { const authorization = authMap[row.autorizacion_gasto_id]; return { ...row, autorizacion: authorization, movimiento: movementMap[row.movimiento_tesoreria_id], creador: peopleMap[row.creada_por], presidente: peopleMap[authorization?.solicitante_id], tesorero: peopleMap[authorization?.tesorero_id] || peopleMap[movementMap[row.movimiento_tesoreria_id]?.usuario_id], historial: historyMap[row.autorizacion_gasto_id] || [] } }))
    setMovements((movementRows || []).map(row => ({ ...row, autorizacion: authMap[row.autorizacion_gasto_id], tesorero: peopleMap[row.usuario_id], historial: historyMap[row.autorizacion_gasto_id] || [] })))
    setLoading(false)
  }

  useEffect(() => { if (user?.id) loadData() }, [user?.id])

  const addAlertToReport = async () => {
    if (!selected || !user?.id || !comment.trim()) { alert('El comentario fiscal es obligatorio.'); return }
    if (!roleId) { alert('No fue posible validar el rol Fiscal.'); return }
    if (selected.kind === 'alert') {
      const { error } = await supabase.rpc('komerizo_incluir_alerta_reporte_fiscal', { p_alerta_id: selected.item.id, p_fiscal_id: user.id, p_fiscal_rol_id: roleId, p_comentario: comment.trim() })
      if (error) { alert(error.message); return }
    } else {
      const movement = selected.item
      const { error } = await supabase.rpc('komerizo_marcar_egreso_por_fiscal', { p_movimiento_id: movement.id, p_fiscal_id: user.id, p_fiscal_rol_id: roleId, p_motivo: comment.trim() })
      if (error) { alert(error.message); return }
    }
    setSelected(null); setComment(''); await loadData()
  }

  if (loading) return <div className="audit-page"><p>Cargando auditoría...</p></div>
  return <div className="audit-page">
    <div className="audit-header"><div><h1>Auditoría financiera</h1><p>Revisión de alertas y egresos oficiales</p></div><div className="audit-tabs"><button className={tab === 'alertas' ? 'active' : ''} onClick={() => setTab('alertas')}>Alertas ({alerts.length})</button><button className={tab === 'registrados' ? 'active' : ''} onClick={() => setTab('registrados')}>Egresos registrados</button></div></div>
    {tab === 'alertas' ? <section>{alerts.length === 0 ? <div className="audit-card">No hay alertas fiscales.</div> : alerts.map(alert => <article className="audit-card" key={alert.id}><div className="audit-title"><div><h2>Alerta #{alert.id} · {alert.origen === 'tesorero' ? 'Tesorero' : 'Fiscal'}</h2><p>{alert.created_at ? new Date(alert.created_at).toLocaleString('es-CO') : '-'}</p></div><span className={`alert-status ${alert.estado}`}>{alert.estado}</span></div><div className="audit-grid"><div><b>Solicitud/egreso</b><span>#{alert.autorizacion?.id || alert.movimiento?.id || '-'}</span></div><div><b>Monto</b><span>{currency(alert.autorizacion?.monto_solicitado || alert.movimiento?.cantidad)}</span></div><div><b>Concepto</b><span>{alert.autorizacion?.concepto || alert.movimiento?.descripcion || '-'}</span></div><div><b>Presidente</b><span>{alert.presidente || (alert.autorizacion?.solicitante_id ? `Usuario #${alert.autorizacion.solicitante_id}` : '-')}</span></div><div><b>Tesorero</b><span>{alert.tesorero || (alert.autorizacion?.tesorero_id ? `Usuario #${alert.autorizacion.tesorero_id}` : '-')}</span></div><div><b>Motivo del tesorero</b><span>{alert.motivo}</span></div><div><b>Comentario fiscal</b><span>{alert.comentario_fiscal || '-'}</span></div></div>{(alert.movimiento?.archivo_adjunto_url || alert.autorizacion?.archivo_adjunto_url) && <a href={alert.movimiento?.archivo_adjunto_url || alert.autorizacion?.archivo_adjunto_url} target="_blank" rel="noreferrer">Ver soporte</a>}{alert.origen === 'tesorero' && <div className="history"><button className="link-button" onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}>{expanded === alert.id ? 'Ocultar' : 'Ver'} historial completo</button>{expanded === alert.id && (alert.historial.length ? alert.historial.map((event: any) => <div className="history-row" key={event.id}><span>{event.created_at ? new Date(event.created_at).toLocaleString('es-CO') : '-'}</span><b>{event.accion}</b><span>{event.comentario || `${event.estado_anterior || ''} → ${event.estado_nuevo || ''}`}</span></div>) : <p>Sin historial.</p>)}</div>}{alert.estado === 'abierta' && <button onClick={() => setSelected({ kind: 'alert', item: alert })}>Agregar al reporte</button>}</article>)}</section> : <section>{movements.length === 0 ? <div className="audit-card">No hay egresos registrados.</div> : movements.map(movement => <article className="audit-card" key={movement.id}><div className="audit-title"><div><h2>Movimiento #{movement.id}</h2><p>{movement.fecha_movimiento || movement.creado_at}</p></div><span className="alert-status registrada">Registrado</span></div><div className="audit-grid"><div><b>Fecha</b><span>{movement.fecha_movimiento || '-'}</span></div><div><b>Monto</b><span>{currency(movement.cantidad)}</span></div><div><b>Concepto</b><span>{movement.descripcion}</span></div><div><b>Beneficiario</b><span>{movement.beneficiario_destino || '-'}</span></div><div><b>Método de pago</b><span>{movement.metodo_pago || '-'}</span></div><div><b>Solicitud de Presidencia</b><span>{movement.autorizacion?.id ? `#${movement.autorizacion.id}` : 'No vinculada'}</span></div><div><b>Tesorero</b><span>{movement.tesorero || (movement.usuario_id ? `Usuario #${movement.usuario_id}` : '-')}</span></div><div><b>Acta</b><span>{movement.autorizacion?.numero_acta || movement.referencia_externa || '-'}</span></div></div>{movement.archivo_adjunto_url && <a href={movement.archivo_adjunto_url} target="_blank" rel="noreferrer">Ver soporte</a>}{movement.autorizacion?.id && <div className="history"><button className="link-button" onClick={() => setExpanded(expanded === movement.id ? null : movement.id)}>{expanded === movement.id ? 'Ocultar' : 'Ver'} historial de la solicitud</button>{expanded === movement.id && movement.historial.map((event: any) => <div className="history-row" key={event.id}><span>{event.created_at ? new Date(event.created_at).toLocaleString('es-CO') : '-'}</span><b>{event.accion}</b><span>{event.comentario || `${event.estado_anterior || ''} → ${event.estado_nuevo || ''}`}</span></div>)}</div>}<button onClick={() => setSelected({ kind: 'movement', item: movement })}>Agregar inconsistencia al reporte</button></article>)}</section>}
    {selected && <div className="modal-backdrop"><div className="modal-card"><h2>{selected.kind === 'alert' ? 'Agregar al reporte' : 'Agregar inconsistencia al reporte'}</h2><label>Comentario fiscal<textarea value={comment} onChange={event => setComment(event.target.value)} autoFocus /></label><div className="modal-actions"><button disabled={!comment.trim()} onClick={addAlertToReport}>Guardar</button><button className="secondary" onClick={() => { setSelected(null); setComment('') }}>Cancelar</button></div></div></div>}
  </div>
}
