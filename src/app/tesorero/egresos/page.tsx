'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import './egresos.css'

const currency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)
const labels: Record<string, string> = { pendiente_tesoreria: 'Pendiente', reenviado_tesoreria: 'Reenviado', devuelto_presidente: 'Devuelto', registrado: 'Registrado', alertado_fiscal: 'Alerta fiscal' }

export default function TesoreroEgresosPage() {
  const { user } = useAuth()
  const [roleId, setRoleId] = useState<number | null>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [view, setView] = useState<'pendientes' | 'todos'>('pendientes')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<{ expense: any; action: 'return' | 'alert' } | null>(null)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    const { data: role } = await supabase.from('komerizo_roles').select('id').eq('nombre', 'Tesorero').single()
    if (role) setRoleId(role.id)
    const { data, error } = await supabase.from('komerizo_autorizaciones_gasto').select('*').in('estado', ['pendiente_tesoreria', 'reenviado_tesoreria', 'devuelto_presidente', 'alertado_fiscal', 'registrado']).order('created_at', { ascending: false })
    const rows = data || []
    const userIds = [...new Set(rows.map(row => row.solicitante_id).filter(Boolean))]
    const { data: people } = userIds.length ? await supabase.from('komerizo_usuarios').select('id,nombre,apellido').in('id', userIds) : { data: [] }
    const ids = rows.map(row => row.id)
    const { data: history } = ids.length ? await supabase.from('komerizo_autorizaciones_gasto_historial').select('*').in('autorizacion_id', ids).order('created_at', { ascending: true }) : { data: [] }
    const peopleMap = Object.fromEntries((people || []).map(person => [person.id, `${person.nombre} ${person.apellido}`]))
    const historyMap: Record<string, any[]> = {}
    ;(history || []).forEach(item => { (historyMap[item.autorizacion_id] ||= []).push(item) })
    setRequests(rows.map(row => ({ ...row, presidente: peopleMap[row.solicitante_id] || 'Presidente', historial: historyMap[row.id] || [] })))
    if (error) alert('No fue posible cargar los egresos.')
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user?.id])

  const register = async (expense: any) => {
    if (!user?.id || !roleId) return
    setSaving(true)
    const { error } = await supabase.rpc('komerizo_registrar_egreso_autorizado', { p_autorizacion_id: expense.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId })
    setSaving(false)
    if (error) { alert(error.message); return }
    alert('Egreso registrado en tesorería.')
    await loadData()
  }

  const resolveAction = async () => {
    if (!selected || !user?.id || !roleId || !reason.trim()) { alert('El motivo es obligatorio.'); return }
    setSaving(true)
    const rpc = selected.action === 'return' ? 'komerizo_devolver_egreso_presidencia' : 'komerizo_alertar_egreso_fiscal'
    const { error } = await supabase.rpc(rpc, {
      p_autorizacion_id: selected.expense.id,
      p_tesorero_id: user.id,
      p_tesorero_rol_id: roleId,
      p_motivo: reason.trim(),
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    setSelected(null); setReason(''); await loadData()
  }

  const visible = view === 'pendientes' ? requests.filter(item => ['pendiente_tesoreria', 'reenviado_tesoreria'].includes(item.estado)) : requests
  if (loading) return <div className="treasury-workflow"><p>Cargando egresos...</p></div>
  return <div className="treasury-workflow">
    <div className="workflow-header"><div><h1>Egresos por revisar</h1><p>Revisión de solicitudes de Presidencia</p></div><div className="tabs"><button className={view === 'pendientes' ? 'active' : ''} onClick={() => setView('pendientes')}>Pendientes de revisión</button><button className={view === 'todos' ? 'active' : ''} onClick={() => setView('todos')}>Todo el historial</button></div></div>
    {visible.length === 0 ? <div className="workflow-card"><p>No hay egresos en esta sección.</p></div> : visible.map(expense => <article className="workflow-card" key={expense.id}>
      <div className="workflow-title"><div><h2>Egreso #{expense.id}</h2><p>{expense.presidente} · Solicitud {expense.created_at ? new Date(expense.created_at).toLocaleDateString('es-CO') : '-'}</p></div><span className={`status ${expense.estado}`}>{labels[expense.estado]}</span></div>
      <div className="details-grid"><div><b>Fecha del egreso</b><span>{expense.fecha_egreso || '-'}</span></div><div><b>Monto</b><span>{currency(expense.monto_solicitado)}</span></div><div><b>Concepto</b><span>{expense.concepto || '-'}</span></div><div><b>Beneficiario</b><span>{expense.beneficiario_destino || '-'}</span></div><div><b>Método de pago</b><span>{expense.metodo_pago || '-'}</span></div><div><b>Órgano responsable</b><span>{expense.organo_responsable || '-'}</span></div><div><b>Número de acta</b><span>{expense.numero_acta || '-'}</span></div><div><b>Justificación</b><span>{expense.justificacion || '-'}</span></div></div>
      <div className="links">{expense.archivo_adjunto_url ? <a href={expense.archivo_adjunto_url} target="_blank" rel="noreferrer">Ver documento de soporte</a> : 'Sin documento de soporte'}</div>
      <div className="history"><h3>Historial</h3>{expense.historial.length ? expense.historial.map((event: any) => <div className="history-row" key={event.id}><span>{event.created_at ? new Date(event.created_at).toLocaleString('es-CO') : '-'}</span><b>{event.accion}</b><span>{event.comentario || `${event.estado_anterior || ''} → ${event.estado_nuevo || ''}`}</span></div>) : <p>Sin historial.</p>}</div>
      {['pendiente_tesoreria', 'reenviado_tesoreria'].includes(expense.estado) && <div className="action-row"><button disabled={saving} onClick={() => register(expense)}>Registrar en tesorería</button><button className="return" onClick={() => setSelected({ expense, action: 'return' })}>Solicitar corrección</button><button className="alert" onClick={() => setSelected({ expense, action: 'alert' })}>Reportar inconsistencia al Fiscal</button></div>}
    </article>)}
    {selected && <div className="modal-backdrop"><div className="modal-card"><h2>{selected.action === 'return' ? 'Solicitar corrección' : 'Reportar inconsistencia al Fiscal'}</h2><label>Motivo<textarea value={reason} onChange={event => setReason(event.target.value)} autoFocus /></label><div className="action-row"><button disabled={saving || !reason.trim()} onClick={resolveAction}>Guardar</button><button className="secondary" onClick={() => { setSelected(null); setReason('') }}>Cancelar</button></div></div></div>}
  </div>
}
