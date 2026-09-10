/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import './documentos.css'

type Documento = {
  id: string | number
  titulo: string
  descripcion: string
  tipo: string
  fecha: string
  archivo_url: string | null
}

export default function UsuarioDocumentos() {
  const [documentos, setDocumentos] = useState<Documento[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('Todos')

  useEffect(() => { fetchDocumentos() }, [])

  const fetchDocumentos = async () => {
    try {
      setLoading(true)
      const [{ data: docsOficiales, error: errDocs }, { data: actas, error: errActas }, { data: informes, error: errInformes }] = await Promise.all([
        supabase.from('komerizo_documentos_oficiales').select('*').eq('estado_vigencia', 'vigente').eq('estado_aprobacion', 'aprobado'),
        supabase.from('komerizo_actas').select('*').eq('estado', 'publicada'),
        supabase.from('komerizo_informes').select('id,titulo,contenido,archivo_url,fecha_creacion,rol_id').eq('estado', 'completado').eq('es_publico', true),
      ])
      if (errDocs) throw errDocs
      if (errActas) throw errActas
      if (errInformes) throw errInformes

      const reportRoleIds = Array.from(new Set((informes || []).map((report: any) => report.rol_id).filter(Boolean)))
      const { data: reportRoles, error: errRoles } = reportRoleIds.length ? await supabase.from('komerizo_roles').select('id,nombre').in('id', reportRoleIds) : { data: [], error: null }
      if (errRoles) throw errRoles
      const roleNames = Object.fromEntries((reportRoles || []).map((role: any) => [role.id, role.nombre]))

      const formatDocs: Documento[] = (docsOficiales || []).map((doc: any) => ({ id: doc.id, titulo: doc.titulo, descripcion: doc.descripcion || '', tipo: doc.tipo_documento, fecha: new Date(doc.fecha_subida).toLocaleDateString(), archivo_url: doc.archivo_url }))
      const formatActas: Documento[] = (actas || []).map((acta: any) => ({ id: `acta-${acta.id}`, titulo: acta.titulo, descripcion: `Acta de ${acta.tipo_acta}`, tipo: 'Acta', fecha: new Date(acta.fecha_acta).toLocaleDateString(), archivo_url: acta.archivo_url }))
      const formatInformes: Documento[] = (informes || []).map((informe: any) => ({ id: `informe-${informe.id}`, titulo: informe.titulo, descripcion: `${roleNames[informe.rol_id] || 'Rol'}: ${informe.contenido}`, tipo: 'Informe de gestión', fecha: new Date(informe.fecha_creacion).toLocaleDateString(), archivo_url: informe.archivo_url }))
      setDocumentos([...formatDocs, ...formatActas, ...formatInformes].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()))
    } catch (error) { console.error('Error cargando documentos:', error) }
    finally { setLoading(false) }
  }

  const documentosFiltrados = documentos.filter(doc => {
    if (filtro === 'Todos') return true
    if (filtro === 'Actas') return doc.tipo === 'Acta'
    if (filtro === 'Reglamentos') return doc.tipo.includes('Reglamento')
    if (filtro === 'Estatutos') return doc.tipo.includes('Estatuto')
    if (filtro === 'Informes') return doc.tipo === 'Informe de gestión'
    return true
  })

  return <div className="documentos-container">
    <div className="documentos-header"><h1>📚 Documentos Oficiales</h1><p className="header-subtitle">Consulta las actas, estatutos, reglamentos e informes de la JAC</p></div>
    <div className="filtros-section">{['Todos', 'Actas', 'Reglamentos', 'Estatutos', 'Informes'].map(tipo => <button key={tipo} className={`btn-filtro ${filtro === tipo ? 'activo' : ''}`} onClick={() => setFiltro(tipo)}>{tipo}</button>)}</div>
    {loading ? <div className="loading">Cargando documentos...</div> : documentosFiltrados.length === 0 ? <div className="empty-state">No se encontraron documentos en esta categoría.</div> : <div className="documentos-grid">{documentosFiltrados.map(doc => <div key={doc.id} className="documento-card"><div className="doc-icon">{doc.tipo === 'Acta' ? '📝' : doc.tipo.includes('Estatuto') ? '⚖️' : '📋'}</div><div className="doc-info"><h3>{doc.titulo}</h3><span className="doc-tipo">{doc.tipo}</span><p>{doc.descripcion}</p><span className="doc-fecha">Publicado: {doc.fecha}</span></div><div className="doc-actions">{doc.archivo_url ? <a href={doc.archivo_url} target="_blank" rel="noopener noreferrer" className="btn-descargar">Descargar</a> : <button className="btn-descargar disabled" disabled>Sin archivo</button>}</div></div>)}</div>}
  </div>
}
