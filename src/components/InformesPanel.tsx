/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/exhaustive-deps */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { uploadReportDocument } from '@/lib/reportStorage'
import './InformesPanel.css'

type InformesPanelProps = { roleName: string }
type Tab = 'recibidas' | 'publicados' | 'enviadas'
type RequestRow = any

const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString('es-CO') : '-'
const authorName = (user: any) => user ? `${user.nombre || ''} ${user.apellido || ''}`.trim() || '-' : '-'

export default function InformesPanel({ roleName }: InformesPanelProps) {
  const { user } = useAuth()
  const [roleId, setRoleId] = useState<number | null>(null)
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [tab, setTab] = useState<Tab>('recibidas')
  const [requests, setRequests] = useState<RequestRow[]>([])
  const [reports, setReports] = useState<any[]>([])
  const [users, setUsers] = useState<Record<number, any>>({})
  const [roles, setRoles] = useState<any[]>([])
  const [movements, setMovements] = useState<Record<number, any>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [responding, setResponding] = useState<RequestRow | null>(null)
  const [responseTitle, setResponseTitle] = useState('')
  const [responseContent, setResponseContent] = useState('')
  const [responseFile, setResponseFile] = useState<File | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [reportTitle, setReportTitle] = useState('')
  const [reportContent, setReportContent] = useState('')
  const [reportFile, setReportFile] = useState<File | null>(null)
  const [reportPublic, setReportPublic] = useState(true)
  const [requestRole, setRequestRole] = useState('')
  const [requestMessage, setRequestMessage] = useState('')

  const loadData = async (currentRoleId: number) => {
    setLoading(true)
    setError('')
    const [incomingResult, outgoingResult, reportResult, roleResult] = await Promise.all([
      supabase.from('komerizo_solicitud_informes').select('*').eq('destinatario_rol_id', currentRoleId).order('fecha_solicitud', { ascending: false }),
      supabase.from('komerizo_solicitud_informes').select('*').eq('usuario_id', user?.id).order('fecha_solicitud', { ascending: false }),
      supabase.from('komerizo_informes').select('*').eq('rol_id', currentRoleId).eq('estado', 'completado').order('fecha_creacion', { ascending: false }),
      supabase.from('komerizo_roles').select('id,nombre').order('nombre'),
    ])
    const firstError = incomingResult.error || outgoingResult.error || reportResult.error || roleResult.error
    if (firstError) { setError(firstError.message); setLoading(false); return }
    const incoming = incomingResult.data || []
    const outgoing = outgoingResult.data || []
    const nextReports = reportResult.data || []
    const nextRoles = roleResult.data || []
    const userIds = Array.from(new Set([...incoming, ...outgoing, ...nextReports].flatMap(row => [row.usuario_id, row.destinatario_id]).filter(id => id && id !== 0)))
    const movementIds = Array.from(new Set(incoming.map(row => row.movimiento_tesoreria_id).filter(Boolean)))
    const [{ data: userRows, error: usersError }, { data: movementRows, error: movementsError }] = await Promise.all([
      userIds.length ? supabase.from('komerizo_usuarios').select('id,nombre,apellido,cc').in('id', userIds) : Promise.resolve({ data: [], error: null } as any),
      movementIds.length ? supabase.from('komerizo_tesoreria').select('id,fecha_movimiento,descripcion,cantidad').in('id', movementIds) : Promise.resolve({ data: [], error: null } as any),
    ])
    if (usersError || movementsError) setError((usersError || movementsError)?.message || '')
    setRequests([...incoming, ...outgoing].filter((row, index, all) => all.findIndex(item => item.id === row.id) === index))
    setReports(nextReports)
    setRoles(nextRoles)
    setUsers(Object.fromEntries((userRows || []).map((row: any) => [row.id, row])))
    setMovements(Object.fromEntries((movementRows || []).map((row: any) => [row.id, row])))
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    const resolveRole = async () => {
      if (!user?.id) { setAuthorized(false); setLoading(false); return }
      const { data: role, error: roleError } = await supabase.from('komerizo_roles').select('id').eq('nombre', roleName).maybeSingle()
      if (roleError || !role) { if (active) { setAuthorized(false); setLoading(false) }; return }
      const { data: membership, error: membershipError } = await supabase.from('komerizo_usuario_roles').select('id').eq('usuario_id', user.id).eq('rol_id', role.id).maybeSingle()
      if (membershipError || !membership) { if (active) { setAuthorized(false); setLoading(false) }; return }
      if (active) { setRoleId(role.id); setAuthorized(true); await loadData(role.id) }
    }
    resolveRole()
    return () => { active = false }
  }, [user?.id, roleName])

  const received = useMemo(() => requests.filter(item => item.destinatario_rol_id === roleId), [requests, roleId])
  const sent = useMemo(() => requests.filter(item => item.usuario_id === user?.id), [requests, user?.id])
  const requestRoles = useMemo(() => roles.filter(role => !['Usuario', 'Miembro', 'Administrador'].includes(role.nombre) && role.id !== roleId), [roles, roleId])

  const reload = async () => { if (roleId) await loadData(roleId) }
  const submitResponse = async (event: FormEvent) => {
    event.preventDefault()
    if (!responding || !user?.id || !roleId) return
    try {
      setPublishing(true)
      const fileUrl = responseFile ? await uploadReportDocument(responseFile, roleName) : null
      const { error: rpcError } = await supabase.rpc('komerizo_responder_solicitud_informe', { p_solicitud_id: responding.id, p_usuario_responde_id: user.id, p_rol_responde_id: roleId, p_titulo: responseTitle, p_contenido: responseContent, p_archivo_url: fileUrl })
      if (rpcError) throw rpcError
      setResponding(null); setResponseTitle(''); setResponseContent(''); setResponseFile(null); await reload()
    } catch (submitError: any) { setError(submitError.message || 'No fue posible responder la solicitud.') }
    finally { setPublishing(false) }
  }

  const publishReport = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.id || !roleId) return
    try {
      setPublishing(true)
      const fileUrl = reportFile ? await uploadReportDocument(reportFile, roleName) : null
      const { error: rpcError } = await supabase.rpc('komerizo_publicar_informe_gestion', { p_usuario_id: user.id, p_rol_id: roleId, p_titulo: reportTitle, p_contenido: reportContent, p_archivo_url: fileUrl, p_es_publico: reportPublic })
      if (rpcError) throw rpcError
      setReportTitle(''); setReportContent(''); setReportFile(null); setReportPublic(true); await reload()
    } catch (submitError: any) { setError(submitError.message || 'No fue posible publicar el informe.') }
    finally { setPublishing(false) }
  }

  const createRequest = async (event: FormEvent) => {
    event.preventDefault()
    if (!user?.id || !requestRole || !requestMessage.trim()) return
    const { error: insertError } = await supabase.from('komerizo_solicitud_informes').insert({ usuario_id: user.id, destinatario_rol_id: Number(requestRole), destinatario_id: 0, mensaje_solicitud: requestMessage.trim(), mensaje_respuesta: 'Pendiente de respuesta', estado: 'Pendiente' })
    if (insertError) setError(insertError.message)
    else { setRequestRole(''); setRequestMessage(''); await reload() }
  }

  if (authorized === false) return <section className="informes-panel"><p className="informes-error">No tienes permisos para gestionar informes con este rol.</p></section>
  if (authorized === null || loading) return <section className="informes-panel"><p>Cargando informes...</p></section>

  return <main className="informes-panel"><header className="informes-header"><div><h1>Informes</h1><p>{roleName}</p></div></header>
    <nav className="informes-tabs"><button className={tab === 'recibidas' ? 'active' : ''} onClick={() => setTab('recibidas')}>Solicitudes recibidas</button><button className={tab === 'publicados' ? 'active' : ''} onClick={() => setTab('publicados')}>Informes publicados</button><button className={tab === 'enviadas' ? 'active' : ''} onClick={() => setTab('enviadas')}>Solicitudes enviadas</button></nav>
    {error && <p className="informes-error">{error}</p>}
    {tab === 'recibidas' && <section className="informes-section"><h2>Solicitudes recibidas</h2>{received.length === 0 ? <p>No hay solicitudes recibidas.</p> : received.map(request => <article className="informe-card" key={request.id}><div className="informe-meta"><b>Solicitante: {authorName(users[request.usuario_id])}</b><span>Documento: {users[request.usuario_id]?.cc || '-'}</span><span>Fecha: {formatDate(request.fecha_solicitud)}</span><span>Estado: {request.estado || 'Pendiente'}</span></div><p><b>Solicitud:</b> {request.mensaje_solicitud}</p>{request.movimiento_tesoreria_id && movements[request.movimiento_tesoreria_id] && <div className="expense-context"><b>Egreso #{request.movimiento_tesoreria_id}</b><span>Fecha: {formatDate(movements[request.movimiento_tesoreria_id].fecha_movimiento)}</span><span>Concepto: {movements[request.movimiento_tesoreria_id].descripcion}</span><span>Monto: {movements[request.movimiento_tesoreria_id].cantidad}</span></div>}{request.estado === 'Pendiente' && <button onClick={() => { setResponding(request); setResponseTitle(''); setResponseContent(''); setResponseFile(null) }}>Responder</button>}{request.estado === 'Respondido' && <div className="response-context"><p><b>Título:</b> {request.titulo_respuesta || '-'}</p><p><b>Respuesta:</b> {request.mensaje_respuesta || '-'}</p><p><b>Fecha de respuesta:</b> {formatDate(request.fecha_respuesta)}</p><p><b>Respondido por:</b> {authorName(users[request.destinatario_id])}</p>{request.archivo_respuesta_url && <a href={request.archivo_respuesta_url} target="_blank" rel="noreferrer">Ver archivo adjunto</a>}</div>}</article>)}</section>}
    {tab === 'publicados' && <section className="informes-section"><div className="section-heading"><h2>Informes publicados</h2><span>{roleName}</span></div><form className="informe-form" onSubmit={publishReport}><h3>Nuevo informe de gestión</h3><label>Título<input required value={reportTitle} onChange={event => setReportTitle(event.target.value)} /></label><label>Contenido<textarea required value={reportContent} onChange={event => setReportContent(event.target.value)} /></label><label>Archivo adjunto (opcional)<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={event => setReportFile(event.target.files?.[0] || null)} /></label><label>Visibilidad<select value={reportPublic ? 'publico' : 'privado'} onChange={event => setReportPublic(event.target.value === 'publico')}><option value="publico">Público para afiliados</option><option value="privado">Privado</option></select></label><button type="submit" disabled={publishing}>Publicar informe</button></form>{reports.length === 0 ? <p>No hay informes publicados.</p> : reports.map(report => <article className="informe-card" key={report.id}><h3>{report.titulo}</h3><p><b>Tipo de informe:</b> {report.tipo_informe || 'gestión'}</p><p>{report.contenido}</p><div className="informe-meta"><span>Autor: {authorName(users[report.usuario_id])}</span><span>Fecha: {formatDate(report.fecha_creacion)}</span><span>{report.es_publico ? 'Público' : 'Privado'}</span></div>{report.archivo_url && <a href={report.archivo_url} target="_blank" rel="noreferrer">Ver archivo</a>}</article>)}</section>}
    {tab === 'enviadas' && <section className="informes-section"><h2>Solicitudes enviadas</h2><form className="informe-form" onSubmit={createRequest}><h3>Solicitar informe</h3><label>Rol destinatario<select required value={requestRole} onChange={event => setRequestRole(event.target.value)}><option value="">Selecciona un rol</option>{requestRoles.map(role => <option key={role.id} value={role.id}>{role.nombre}</option>)}</select></label><label>Solicitud<textarea required value={requestMessage} onChange={event => setRequestMessage(event.target.value)} /></label><button type="submit">Enviar solicitud</button></form>{sent.length === 0 ? <p>No hay solicitudes enviadas.</p> : sent.map(request => <article className="informe-card" key={request.id}><div className="informe-meta"><span>Rol destinatario: {roles.find(role => role.id === request.destinatario_rol_id)?.nombre || '-'}</span><span>Fecha: {formatDate(request.fecha_solicitud)}</span><span>Estado: {request.estado || 'Pendiente'}</span></div><p><b>Solicitud:</b> {request.mensaje_solicitud}</p>{request.estado === 'Respondido' && <div className="response-context"><p><b>Título de respuesta:</b> {request.titulo_respuesta || '-'}</p><p><b>Respuesta:</b> {request.mensaje_respuesta || '-'}</p><p><b>Fecha:</b> {formatDate(request.fecha_respuesta)}</p>{request.archivo_respuesta_url && <a href={request.archivo_respuesta_url} target="_blank" rel="noreferrer">Ver archivo adjunto</a>}</div>}</article>)}</section>}
    {responding && <div className="informes-modal"><form className="informes-modal-card informe-form" onSubmit={submitResponse}><h2>Responder solicitud</h2><label>Título de la respuesta<input required value={responseTitle} onChange={event => setResponseTitle(event.target.value)} /></label><label>Contenido<textarea required value={responseContent} onChange={event => setResponseContent(event.target.value)} /></label><label>Archivo adjunto (opcional)<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={event => setResponseFile(event.target.files?.[0] || null)} /></label><div><button type="submit" disabled={publishing}>Responder</button><button type="button" onClick={() => setResponding(null)}>Cancelar</button></div></form></div>}
  </main>
}
