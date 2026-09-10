'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const currency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)

export default function SecretarioConfiguracion() {
  const { user } = useAuth()
  const [config, setConfig] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [form, setForm] = useState({ presidente: '', junta: '', motivo: '' })
  const [loading, setLoading] = useState(true)
  const loadData = async () => {
    if (!user?.id) return
    const [{ data: current }, { data: previous }] = await Promise.all([
      supabase.from('komerizo_configuracion_jac').select('*').order('id', { ascending: false }).limit(1).single(),
      supabase.from('komerizo_solicitudes_configuracion_jac').select('*').eq('secretario_id', user.id).order('created_at', { ascending: false }),
    ])
    setConfig(current); setRequests(previous || []); setLoading(false)
  }
  useEffect(() => { loadData() }, [user?.id])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const presidente = Number(form.presidente); const junta = Number(form.junta)
    if (presidente <= 0 || junta <= 0 || junta < presidente || !form.motivo.trim() || !user?.id) { alert('Verifica los montos y el motivo de la solicitud.'); return }
    const { error } = await supabase.from('komerizo_solicitudes_configuracion_jac').insert({ secretario_id: user.id, tope_gasto_presidente: presidente, tope_gasto_junta: junta, motivo: form.motivo.trim(), estado: 'pendiente' })
    if (error) { alert(error.message); return }
    setForm({ presidente: '', junta: '', motivo: '' }); await loadData(); alert('Solicitud enviada al Administrador.')
  }
  if (loading) return <div style={{ padding: '2rem' }}>Cargando configuración...</div>
  return <div style={{ padding: '2rem', maxWidth: 1000 }}><h1>Configuración financiera</h1><section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}><h2>Topes financieros actuales</h2><p>Tope Presidente: <strong>{currency(config?.tope_gasto_presidente)}</strong></p><p>Tope Junta Directiva: <strong>{currency(config?.tope_gasto_junta)}</strong></p><p>Última actualización: {config?.fecha_actualizacion ? new Date(config.fecha_actualizacion).toLocaleString('es-CO') : '-'}</p></section><section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}><h2>Solicitar actualización</h2><form onSubmit={submit} style={{ display: 'grid', gap: '1rem' }}><label>Nuevo tope Presidente<input type="number" min="1" value={form.presidente} onChange={e => setForm({ ...form, presidente: e.target.value })} required /></label><label>Nuevo tope Junta Directiva<input type="number" min="1" value={form.junta} onChange={e => setForm({ ...form, junta: e.target.value })} required /></label><label>Motivo<textarea value={form.motivo} onChange={e => setForm({ ...form, motivo: e.target.value })} required /></label><button type="submit">Enviar solicitud</button></form></section><section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8 }}><h2>Mis solicitudes anteriores</h2>{requests.length === 0 ? <p>No has enviado solicitudes.</p> : requests.map(request => <div key={request.id} style={{ borderBottom: '1px solid #46566c', padding: '1rem 0' }}><strong>{currency(request.tope_gasto_presidente)} / {currency(request.tope_gasto_junta)}</strong><p>{request.motivo}</p><span style={{ background: request.estado === 'aplicada' ? '#1d5a3b' : request.estado === 'rechazada' ? '#6a2730' : '#735a19', padding: '.3rem .5rem', borderRadius: 99 }}>{request.estado === 'aplicada' ? 'Aplicada' : request.estado === 'rechazada' ? 'Rechazada' : 'Pendiente'}</span>{request.comentario_administrador && <p>Comentario: {request.comentario_administrador}</p>}</div>)}</section></div>
}
