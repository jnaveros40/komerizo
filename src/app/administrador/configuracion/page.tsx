'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const currency = (value: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)

export default function AdministradorConfiguracionPage() {
  const { user } = useAuth()
  const [config, setConfig] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [rejecting, setRejecting] = useState<any | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(true)
  const loadData = async () => {
    const [{ data: current }, { data: pending }] = await Promise.all([
      supabase.from('komerizo_configuracion_jac').select('*').order('id', { ascending: false }).limit(1).single(),
      supabase.from('komerizo_solicitudes_configuracion_jac').select('*, komerizo_usuarios(nombre,apellido)').eq('estado', 'pendiente').order('created_at', { ascending: true }),
    ])
    setConfig(current); setRequests(pending || []); setLoading(false)
  }
  useEffect(() => { loadData() }, [])
  const apply = async (request: any) => {
    if (!user?.id) return
    const { error } = await supabase.rpc('komerizo_aplicar_solicitud_configuracion', {
      p_solicitud_id: request.id,
      p_administrador_id: user.id,
    })
    if (error) { alert(error.message); return }
    await loadData()
  }
  const reject = async () => {
    if (!rejecting || !user?.id || !comment.trim()) { alert('El comentario es obligatorio.'); return }
    const { error } = await supabase.from('komerizo_solicitudes_configuracion_jac').update({ estado: 'rechazada', administrador_id: user.id, comentario_administrador: comment.trim(), resolved_at: new Date().toISOString() }).eq('id', rejecting.id)
    if (error) { alert(error.message); return }
    setRejecting(null); setComment(''); await loadData()
  }
  if (loading) return <div style={{ padding: '2rem' }}>Cargando configuración...</div>
  return <div style={{ padding: '2rem', maxWidth: 1100 }}><h1>Configuración financiera</h1><section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8, marginBottom: '1.5rem' }}><h2>Valores actuales</h2><p>Tope Presidente: <strong>{currency(config?.tope_gasto_presidente)}</strong></p><p>Tope Junta Directiva: <strong>{currency(config?.tope_gasto_junta)}</strong></p><p>Última actualización: {config?.fecha_actualizacion ? new Date(config.fecha_actualizacion).toLocaleString('es-CO') : '-'}</p></section><section style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8 }}><h2>Solicitudes pendientes</h2>{requests.length === 0 ? <p>No hay solicitudes pendientes.</p> : requests.map(request => <div key={request.id} style={{ borderTop: '1px solid #46566c', padding: '1rem 0' }}><h3>{request.komerizo_usuarios ? `${request.komerizo_usuarios.nombre} ${request.komerizo_usuarios.apellido}` : `Secretario #${request.secretario_id}`}</h3><p>Presidente: {currency(request.tope_gasto_presidente)} · Junta: {currency(request.tope_gasto_junta)}</p><p>Motivo: {request.motivo}</p><p>Fecha: {new Date(request.created_at).toLocaleString('es-CO')}</p><div style={{ display: 'flex', gap: '.7rem' }}><button onClick={() => apply(request)}>Aplicar</button><button onClick={() => setRejecting(request)}>Rechazar</button></div></div>)}</section>{rejecting && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', padding: '1rem' }}><div style={{ background: '#1e2a3a', color: '#fff', padding: '1.5rem', borderRadius: 8, width: 'min(500px,100%)' }}><h2>Rechazar solicitud</h2><label>Comentario del Administrador<textarea value={comment} onChange={e => setComment(e.target.value)} required /></label><div style={{ display: 'flex', gap: '.7rem', marginTop: '1rem' }}><button onClick={reject}>Guardar rechazo</button><button onClick={() => { setRejecting(null); setComment('') }}>Cancelar</button></div></div></div>}</div>
}
