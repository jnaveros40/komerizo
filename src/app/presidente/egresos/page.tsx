'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { uploadFinancialDocument } from '@/lib/documentStorage'
import './egresos.css'

type FormState = {
  fecha_egreso: string
  monto_solicitado: string
  concepto: string
  beneficiario_destino: string
  metodo_pago: string
  justificacion: string
  organo_responsable: string
  numero_acta: string
}

const emptyForm = (): FormState => ({
  fecha_egreso: new Date().toISOString().slice(0, 10),
  monto_solicitado: '', concepto: '', beneficiario_destino: '', metodo_pago: '',
  justificacion: '', organo_responsable: 'presidencia', numero_acta: '',
})

const currency = (value: number) => new Intl.NumberFormat('es-CO', {
  style: 'currency', currency: 'COP', maximumFractionDigits: 0,
}).format(Number(value) || 0)

const statusLabels: Record<string, string> = {
  pendiente_tesoreria: 'Pendiente de revisión',
  devuelto_presidente: 'Requiere corrección',
  reenviado_tesoreria: 'Corregido y reenviado',
  registrado: 'Registrado en tesorería',
  alertado_fiscal: 'Reportado para revisión fiscal',
}

export default function PresidenteEgresosPage() {
  const { user } = useAuth()
  const [roleId, setRoleId] = useState<number | null>(null)
  const [threshold, setThreshold] = useState(0)
  const [configLoaded, setConfigLoaded] = useState(false)
  const [expenses, setExpenses] = useState<any[]>([])
  const [form, setForm] = useState<FormState>(emptyForm())
  const [file, setFile] = useState<File | null>(null)
  const [editing, setEditing] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm())
  const [editFile, setEditFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const amount = Number(form.monto_solicitado) || 0
  const editAmount = Number(editForm.monto_solicitado) || 0
  const overThreshold = amount > threshold
  const editOverThreshold = editAmount > threshold

  const loadData = async () => {
    if (!user?.id) return
    setLoading(true)
    const [{ data: role }, { data: config, error: configError }, { data: rows, error }] = await Promise.all([
      supabase.from('komerizo_roles').select('id').eq('nombre', 'Presidente').single(),
      supabase.from('komerizo_configuracion_jac').select('tope_gasto_presidente').order('id', { ascending: false }).limit(1).single(),
      supabase.from('komerizo_autorizaciones_gasto').select('*').eq('solicitante_id', user.id).order('created_at', { ascending: false }),
    ])
    if (role) setRoleId(role.id)
    if (config && !configError && Number(config.tope_gasto_presidente) > 0) {
      setThreshold(Number(config.tope_gasto_presidente))
      setConfigLoaded(true)
    } else {
      setThreshold(0)
      setConfigLoaded(false)
    }
    if (!error) setExpenses(rows || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [user?.id])

  const validate = (current: FormState, hasFile: boolean, previousFile: string | null = null) => {
    const currentAmount = Number(current.monto_solicitado)
    if (!current.fecha_egreso || currentAmount <= 0 || !current.concepto.trim() || !current.beneficiario_destino.trim() || !current.metodo_pago) {
      return 'Completa todos los campos obligatorios del egreso.'
    }
    const support = hasFile || Boolean(previousFile)
    if (currentAmount <= threshold) {
      if (!support && !current.justificacion.trim()) return 'La justificación es obligatoria si no adjuntas soporte.'
    } else if (!['junta_directiva', 'asamblea_general'].includes(current.organo_responsable) || !current.numero_acta.trim() || !support) {
      return 'Los egresos sobre el tope requieren órgano, número de acta y soporte.'
    }
    return null
  }

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id || !roleId) return
    if (!configLoaded) { alert('No existe una configuración financiera válida. Solicita al Secretario/Administrador configurar las cuantías.'); return }
    const validation = validate(form, Boolean(file))
    if (validation) { alert(validation); return }
    setSaving(true)
    try {
      const supportUrl = file ? await uploadFinancialDocument(file, `presidente-${user.id}`) : null
      const { error } = await supabase.rpc('komerizo_crear_solicitud_egreso_presidencia', {
        p_presidente_id: user.id,
        p_presidente_rol_id: roleId,
        p_fecha_egreso: form.fecha_egreso,
        p_monto: amount,
        p_concepto: form.concepto.trim(),
        p_beneficiario_destino: form.beneficiario_destino.trim(),
        p_metodo_pago: form.metodo_pago,
        p_justificacion: form.justificacion.trim() || null,
        p_archivo_adjunto_url: supportUrl,
        p_organo_responsable: form.organo_responsable,
        p_numero_acta: form.numero_acta.trim() || null,
      })
      if (error) throw error
      setForm(emptyForm()); setFile(null); await loadData(); alert('Egreso enviado a tesorería.')
    } catch (error: any) { alert(error.message || 'No fue posible crear el egreso.') }
    finally { setSaving(false) }
  }

  const startCorrection = (expense: any) => {
    setEditing(expense)
    setEditForm({
      fecha_egreso: expense.fecha_egreso || '', monto_solicitado: String(expense.monto_solicitado || ''),
      concepto: expense.concepto || '', beneficiario_destino: expense.beneficiario_destino || '',
      metodo_pago: expense.metodo_pago || '', justificacion: expense.justificacion || '',
      organo_responsable: expense.organo_responsable || 'presidencia', numero_acta: expense.numero_acta || '',
    })
    setEditFile(null)
  }

  const handleCorrection = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!user?.id || !roleId || !editing) return
    if (!configLoaded) { alert('No existe una configuración financiera válida. Solicita al Secretario/Administrador configurar las cuantías.'); return }
    const validation = validate(editForm, Boolean(editFile), editing.archivo_adjunto_url)
    if (validation) { alert(validation); return }
    setSaving(true)
    try {
      const supportUrl = editFile ? await uploadFinancialDocument(editFile, `presidente-${user.id}`) : null
      const { error } = await supabase.rpc('komerizo_corregir_solicitud_egreso_presidencia', {
        p_autorizacion_id: editing.id,
        p_presidente_id: user.id,
        p_presidente_rol_id: roleId,
        p_fecha_egreso: editForm.fecha_egreso,
        p_monto: editAmount,
        p_concepto: editForm.concepto.trim(),
        p_beneficiario_destino: editForm.beneficiario_destino.trim(),
        p_metodo_pago: editForm.metodo_pago,
        p_justificacion: editForm.justificacion.trim() || null,
        p_archivo_adjunto_url: supportUrl,
        p_organo_responsable: editForm.organo_responsable,
        p_numero_acta: editForm.numero_acta.trim() || null,
        p_comentario: 'Corrección enviada por Presidencia',
      })
      if (error) throw error
      setEditing(null); await loadData(); alert('Corrección reenviada a tesorería.')
    } catch (error: any) { alert(error.message || 'No fue posible reenviar la corrección.') }
    finally { setSaving(false) }
  }

  const updateForm = (setter: React.Dispatch<React.SetStateAction<FormState>>, field: keyof FormState, value: string) => setter(previous => ({ ...previous, [field]: value }))
  const fields = useMemo(() => (formState: FormState, setter: React.Dispatch<React.SetStateAction<FormState>>, currentOver: boolean, currentFile: File | null, setCurrentFile: (file: File | null) => void, oldUrl?: string | null) => (
    <>
      <div className="form-grid">
        <label>Fecha<input type="date" value={formState.fecha_egreso} onChange={e => updateForm(setter, 'fecha_egreso', e.target.value)} required /></label>
        <label>Monto<input type="number" min="1" step="0.01" value={formState.monto_solicitado} onChange={e => updateForm(setter, 'monto_solicitado', e.target.value)} required /></label>
        <label>Concepto o motivo<input value={formState.concepto} onChange={e => updateForm(setter, 'concepto', e.target.value)} required /></label>
        <label>Beneficiario o destino<input value={formState.beneficiario_destino} onChange={e => updateForm(setter, 'beneficiario_destino', e.target.value)} required /></label>
        <label>Método de pago<select value={formState.metodo_pago} onChange={e => updateForm(setter, 'metodo_pago', e.target.value)} required><option value="">Selecciona</option><option>Efectivo</option><option>Transferencia</option><option>Cheque</option><option>Otro</option></select></label>
        {currentOver && <label>Órgano responsable<select value={formState.organo_responsable} onChange={e => updateForm(setter, 'organo_responsable', e.target.value)}><option value="junta_directiva">Junta Directiva</option><option value="asamblea_general">Asamblea General</option></select></label>}
        {currentOver && <label>Número de acta<input value={formState.numero_acta} onChange={e => updateForm(setter, 'numero_acta', e.target.value)} required /></label>}
        <label className="file-field">Documento de soporte<input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={e => setCurrentFile(e.target.files?.[0] || null)} />{currentFile ? currentFile.name : oldUrl ? <a href={oldUrl} target="_blank" rel="noreferrer">Soporte actual</a> : 'Opcional dentro del tope; obligatorio sobre el tope.'}</label>
      </div>
      <label>Justificación<textarea value={formState.justificacion} onChange={e => updateForm(setter, 'justificacion', e.target.value)} placeholder="Explica la necesidad del egreso" /></label>
    </>
  ), [])

  if (loading) return <div className="financial-page"><p>Cargando egresos...</p></div>
  return <div className="financial-page">
    <h1>Egresos de Presidencia</h1>
    {!configLoaded && <p className="notice warning">No existe una configuración financiera válida. Solicita al Secretario/Administrador configurar las cuantías.</p>}
    <p className="threshold">Tope actual de Presidencia: <strong>{currency(threshold)}</strong></p>
    <section className="financial-card">
      <h2>Crear solicitud de egreso</h2>
      {amount > 0 && <p className={overThreshold ? 'notice warning' : 'notice success'}>{overThreshold ? 'Este egreso supera la cuantía de Presidencia y requiere soporte de Junta Directiva o Asamblea General.' : 'Este egreso está dentro de la cuantía autorizada para Presidencia.'}</p>}
      <form onSubmit={handleCreate}>{fields(form, setForm, overThreshold, file, setFile)}<button disabled={saving || !configLoaded}>{saving ? 'Enviando...' : 'Enviar a tesorería'}</button></form>
    </section>
    <section className="financial-card"><h2>Mis solicitudes</h2>{expenses.length === 0 ? <p>No tienes egresos registrados.</p> : <div className="table-wrap"><table><thead><tr><th>ID</th><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Beneficiario</th><th>Método</th><th>Órgano</th><th>Acta</th><th>Estado</th><th>Soporte</th><th /></tr></thead><tbody>{expenses.map(expense => <tr key={expense.id}><td>#{expense.id}</td><td>{expense.fecha_egreso || '-'}</td><td>{expense.concepto || '-'}</td><td>{currency(expense.monto_solicitado)}</td><td>{expense.beneficiario_destino || '-'}</td><td>{expense.metodo_pago || '-'}</td><td>{expense.organo_responsable || '-'}</td><td>{expense.numero_acta || '-'}</td><td><span className={`status ${expense.estado}`}>{statusLabels[expense.estado] || expense.estado}</span>{expense.estado === 'devuelto_presidente' && <small>{expense.motivo_devolucion}</small>}</td><td>{expense.archivo_adjunto_url ? <a href={expense.archivo_adjunto_url} target="_blank" rel="noreferrer">Ver</a> : '—'}</td><td>{expense.estado === 'devuelto_presidente' && <button type="button" onClick={() => startCorrection(expense)}>Corregir</button>}</td></tr>)}</tbody></table></div>}</section>
    {editing && <div className="modal-backdrop"><div className="modal-card"><h2>Corregir egreso #{editing.id}</h2><p className="notice warning">Motivo de devolución: {editing.motivo_devolucion}</p>{editAmount > 0 && <p className={editOverThreshold ? 'notice warning' : 'notice success'}>{editOverThreshold ? 'El egreso requiere órgano, acta y soporte.' : 'El egreso está dentro del tope de Presidencia.'}</p>}<form onSubmit={handleCorrection}>{fields(editForm, setEditForm, editOverThreshold, editFile, setEditFile, editing.archivo_adjunto_url)}<div className="actions"><button disabled={saving}>{saving ? 'Guardando...' : 'Guardar y reenviar'}</button><button type="button" className="secondary" onClick={() => setEditing(null)}>Cancelar</button></div></form></div></div>}
  </div>
}
