/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const currency = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(Number(value) || 0)

export default function AdministradorConfiguracionPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [presidentThreshold, setPresidentThreshold] = useState('')
  const [boardThreshold, setBoardThreshold] = useState('')
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [rejecting, setRejecting] = useState<any | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    const [{ data: current }, { data: pending }] = await Promise.all([
      supabase.from('komerizo_configuracion_jac').select('id,tope_gasto_presidente,tope_gasto_junta,actualizado_por,fecha_actualizacion,motivo_actualizacion').order('id', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('komerizo_solicitudes_configuracion_jac').select('*, komerizo_usuarios(nombre,apellido)').eq('estado', 'pendiente').order('created_at', { ascending: true }),
    ])
    setConfig(current)
    setPresidentThreshold(current?.tope_gasto_presidente != null ? String(current.tope_gasto_presidente) : '')
    setBoardThreshold(current?.tope_gasto_junta != null ? String(current.tope_gasto_junta) : '')
    setRequests(pending || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const saveThresholds = async (event: React.FormEvent) => {
    event.preventDefault()
    const president = Number(presidentThreshold)
    const board = Number(boardThreshold)
    if (president <= 0 || board <= 0) { setFeedback('Ambas cuantías deben ser mayores que cero.'); return }
    if (board < president) { setFeedback('La cuantía de la Junta debe ser mayor o igual a la del Presidente.'); return }
    if (!reason.trim()) { setFeedback('El motivo de la actualización es obligatorio.'); return }
    if (!user?.id) return

    setSaving(true)
    setFeedback('')
    const { error } = await supabase.rpc('komerizo_fijar_cuantias_administrador', {
      p_administrador_id: user.id,
      p_tope_gasto_presidente: president,
      p_tope_gasto_junta: board,
      p_motivo: reason.trim(),
    })
    setSaving(false)
    if (error) { setFeedback(error.message); return }
    setReason('')
    setFeedback('Rangos de cuantía guardados correctamente.')
    await loadData()
  }

  const apply = async (request: any) => {
    if (!user?.id) return
    const { error } = await supabase.rpc('komerizo_aplicar_solicitud_configuracion', { p_solicitud_id: request.id, p_administrador_id: user.id })
    if (error) { alert(error.message); return }
    await loadData()
  }

  const reject = async () => {
    if (!rejecting || !user?.id || !comment.trim()) { alert('El comentario es obligatorio.'); return }
    const { error } = await supabase.from('komerizo_solicitudes_configuracion_jac').update({
      estado: 'rechazada', administrador_id: user.id,
      comentario_administrador: comment.trim(), resolved_at: new Date().toISOString(),
    }).eq('id', rejecting.id)
    if (error) { alert(error.message); return }
    setRejecting(null); setComment(''); await loadData()
  }

  if (loading) return <div style={{ padding: '2rem' }}>Cargando configuración...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>
      <h1>Configuración financiera</h1>
      <section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}>
        <h2>Cuantías actuales</h2>
        <p>Tope Presidente: <strong>{currency(config?.tope_gasto_presidente)}</strong></p>
        <p>Tope Junta Directiva: <strong>{currency(config?.tope_gasto_junta)}</strong></p>
        <p>Última actualización: {config?.fecha_actualizacion ? new Date(config.fecha_actualizacion).toLocaleString('es-CO') : '-'}</p>
        <p>Último motivo de actualización: {config?.motivo_actualizacion?.trim() || 'Sin motivo registrado'}</p>
      </section>

      <section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}>
        <h2>Fijar rangos de cuantía</h2>
        <p>Define los límites de gasto autorizados de acuerdo con los estatutos vigentes de la Junta.</p>
        <form onSubmit={saveThresholds}>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            Cuantía máxima del Presidente
            <input type="number" min="0.01" step="0.01" value={presidentThreshold} onChange={event => setPresidentThreshold(event.target.value)} required style={{ display: 'block', width: '100%', marginTop: '.4rem' }} />
            <small>Valor actual: {currency(config?.tope_gasto_presidente)}</small>
          </label>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            Cuantía máxima de la Junta Directiva
            <input type="number" min="0.01" step="0.01" value={boardThreshold} onChange={event => setBoardThreshold(event.target.value)} required style={{ display: 'block', width: '100%', marginTop: '.4rem' }} />
            <small>Valor actual: {currency(config?.tope_gasto_junta)}</small>
          </label>
          <label style={{ display: 'block', marginTop: '1rem' }}>
            Motivo de la actualización
            <textarea value={reason} onChange={event => setReason(event.target.value)} required style={{ display: 'block', width: '100%', marginTop: '.4rem' }} />
          </label>
          {feedback && <p role="status">{feedback}</p>}
          <button type="submit" disabled={saving} style={{ marginTop: '1rem' }}>{saving ? 'Guardando...' : 'Guardar rangos de cuantía'}</button>
        </form>
      </section>

      <section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8 }}>
        <h2>Solicitudes pendientes del Secretario</h2>
        {requests.length === 0 ? <p>No hay solicitudes pendientes.</p> : requests.map(request => (
          <div key={request.id} style={{ borderTop: '1px solid #46566c', padding: '1rem 0' }}>
            <h3>{request.komerizo_usuarios ? `${request.komerizo_usuarios.nombre} ${request.komerizo_usuarios.apellido}` : `Secretario #${request.secretario_id}`}</h3>
            <p>Presidente: {currency(request.tope_gasto_presidente)} · Junta: {currency(request.tope_gasto_junta)}</p>
            <p>Motivo: {request.motivo}</p>
            <p>Fecha: {new Date(request.created_at).toLocaleString('es-CO')}</p>
            <div style={{ display: 'flex', gap: '.7rem' }}><button onClick={() => apply(request)}>Aplicar</button><button onClick={() => setRejecting(request)}>Rechazar</button></div>
          </div>
        ))}
      </section>

      {rejecting && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: '1rem' }}><div style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8, width: 'min(500px,100%)' }}><h2>Rechazar solicitud</h2><label>Comentario del Administrador<textarea value={comment} onChange={event => setComment(event.target.value)} required /></label><div style={{ display: 'flex', gap: '.7rem', marginTop: '1rem' }}><button onClick={reject}>Guardar rechazo</button><button onClick={() => { setRejecting(null); setComment('') }}>Cancelar</button></div></div></div>}
    </div>
  )
}
