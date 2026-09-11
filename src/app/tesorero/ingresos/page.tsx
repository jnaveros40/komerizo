/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { downloadRentalVoucher, downloadTreasuryReceipt } from '@/lib/financialReceipts'
import './ingresos.css'

const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)
const paymentMethods = ['Efectivo', 'Transferencia', 'Cheque', 'Otro']

export default function TesoreroIngresosPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'rentals' | 'donations'>('rentals')
  const [roleId, setRoleId] = useState<number | null>(null)
  const [resources, setResources] = useState<any[]>([])
  const [rentals, setRentals] = useState<any[]>([])
  const [donations, setDonations] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [paymentRental, setPaymentRental] = useState<any | null>(null)
  const [closeRental, setCloseRental] = useState<any | null>(null)
  const [method, setMethod] = useState('Efectivo')
  const [renter, setRenter] = useState({ tipo: 'externo', usuario: null as number | null, documento: '', nombres: '', apellidos: '', direccion: '', celular: '', correo: '' })
  const [rentalForm, setRentalForm] = useState({ inicio: new Date().toISOString().slice(0, 10), fin: new Date().toISOString().slice(0, 10), deposito: '0', clausulas: '', exonerado: false, justificacion: '' })
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [donation, setDonation] = useState({ tipo: 'donacion', documento: '', nombre: '', celular: '', correo: '', monto: '', justificacion: '', metodo: 'Efectivo', usuario: null as number | null })

  const loadData = async () => {
    const [{ data: role }, { data: inventory }, { data: rentalRows }, { data: donationRows }] = await Promise.all([
      supabase.from('komerizo_roles').select('id').eq('nombre', 'Tesorero').single(),
      supabase.from('komerizo_inventario').select('id,nombre,cantidad,valor_alquiler').eq('es_alquilable', true).eq('estado', 'activo').gt('cantidad', 0).order('nombre'),
      supabase.from('komerizo_alquiler_recursos').select('*,komerizo_alquiler_recursos_items(*,komerizo_inventario(nombre))').order('created_at', { ascending: false }),
      supabase.from('komerizo_ingresos_donaciones_cuotas').select('*').order('created_at', { ascending: false }),
    ])
    if (role) setRoleId(role.id)
    setResources(inventory || []); setRentals(rentalRows || []); setDonations(donationRows || [])
  }
  useEffect(() => { if (user?.id) loadData() }, [user?.id])

  const selectedItems = useMemo(() => Object.entries(quantities).filter(([, qty]) => Number(qty) > 0).map(([id, qty]) => ({ inventario_id: Number(id), cantidad: Number(qty) })), [quantities])
  const updateRenter = (key: string, value: any) => {
    setRenter(current => ({ ...current, [key]: value, ...(key === 'documento' ? { usuario: null } : {}) }))
    if (key === 'documento') setRentalForm(current => ({ ...current, exonerado: false, justificacion: '' }))
  }

  const changeRenterType = (tipo: string) => {
    setRenter(current => ({ ...current, tipo, usuario: tipo === 'afiliado' ? current.usuario : null }))
    setRentalForm(current => ({ ...current, exonerado: false, justificacion: '' }))
  }

  const lookupUser = async (cc: string, target: 'renter' | 'donation') => {
    if (!cc.trim()) return
    const { data } = await supabase.from('komerizo_usuarios').select('id,cc,nombre,apellido,direccion,telefono,correo_electronico,estado').eq('cc', cc.trim()).maybeSingle()
    if (!data) {
      if (target === 'renter') {
        setRenter(current => ({ ...current, usuario: null }))
        setRentalForm(current => ({ ...current, exonerado: false, justificacion: '' }))
      }
      alert('No se encontró un afiliado con ese documento.'); return
    }
    if (target === 'renter') {
      const { data: roles } = await supabase.from('komerizo_usuario_roles').select('komerizo_roles(nombre)').eq('usuario_id', data.id)
      const validAffiliate = data.estado === 'activo' && (roles || []).some((role: any) => ['Usuario', 'Miembro'].includes(role.komerizo_roles?.nombre))
      if (!validAffiliate) {
        setRenter(current => ({ ...current, usuario: null }))
        setRentalForm(current => ({ ...current, exonerado: false, justificacion: '' }))
        alert('Selecciona un afiliado activo válido.'); return
      }
      setRenter(current => ({ ...current, usuario: data.id, documento: data.cc, nombres: data.nombre, apellidos: data.apellido, direccion: data.direccion || '', celular: data.telefono || '', correo: data.correo_electronico || '' }))
    }
    else setDonation(current => ({ ...current, usuario: data.id, documento: data.cc, nombre: `${data.nombre} ${data.apellido}`.trim(), celular: data.telefono || '', correo: data.correo_electronico || '' }))
  }

  const createRental = async (event: React.FormEvent) => {
    event.preventDefault(); if (!user?.id || !roleId || !selectedItems.length) { alert('Selecciona al menos un recurso.'); return }
    setBusy(true)
    const exemptionEnabled = renter.tipo !== 'externo' && rentalForm.exonerado && (renter.tipo === 'comunal' || renter.usuario !== null)
    const depositoGarantia = exemptionEnabled ? 0 : Number(rentalForm.deposito) || 0
    const { error } = await supabase.rpc('komerizo_crear_alquiler_recursos', { p_creado_por: user.id, p_rol_creador_id: roleId, p_tipo_arrendatario: renter.tipo, p_usuario_arrendatario_id: renter.usuario, p_numero_documento: renter.documento, p_nombres: renter.nombres, p_apellidos: renter.apellidos, p_direccion: renter.direccion, p_celular: renter.celular, p_correo: renter.correo, p_fecha_inicio: rentalForm.inicio, p_fecha_fin: rentalForm.fin, p_deposito_garantia: depositoGarantia, p_clausulas_uso: rentalForm.clausulas, p_exonerado_pago: exemptionEnabled, p_justificacion_exoneracion: exemptionEnabled ? rentalForm.justificacion : '', p_items: selectedItems })
    setBusy(false); if (error) { alert(error.message); return }
    alert('Alquiler creado.'); setQuantities({}); setRentalForm(current => ({ ...current, clausulas: '', exonerado: false, justificacion: '' })); await loadData()
  }

  const payRental = async () => { if (!paymentRental || !user?.id || !roleId) return; setBusy(true); const { data, error } = await supabase.rpc('komerizo_confirmar_pago_alquiler_recursos', { p_alquiler_id: paymentRental.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId, p_metodo_pago: method }); setBusy(false); if (error) { alert(error.message); return } setPaymentRental(null); await loadData(); if (data) alert('Pago confirmado.') }
  const cancelRental = async (id: number) => { if (!user?.id || !roleId || !confirm('¿Cancelar este alquiler?')) return; const { error } = await supabase.rpc('komerizo_cancelar_alquiler_recursos', { p_alquiler_id: id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); if (error) alert(error.message); else loadData() }
  const closeRentalAction = async () => { if (!closeRental || !user?.id || !roleId) return; setBusy(true); const { error } = await supabase.rpc('komerizo_cerrar_alquiler_recursos', { p_alquiler_id: closeRental.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId, p_hubo_danos: closeRental.damage, p_observacion: closeRental.observation }); setBusy(false); if (error) { alert(error.message); return } setCloseRental(null); await loadData() }
  const createDonation = async (event: React.FormEvent) => { event.preventDefault(); if (!user?.id || !roleId) return; setBusy(true); const { error } = await supabase.rpc('komerizo_registrar_donacion_cuota', { p_tipo: donation.tipo, p_usuario_asociado_id: donation.usuario, p_numero_documento: donation.documento, p_nombre_persona: donation.nombre, p_celular: donation.celular, p_correo: donation.correo, p_monto: Number(donation.monto), p_justificacion: donation.justificacion, p_metodo_pago: donation.metodo, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); setBusy(false); if (error) { alert(error.message); return } setDonation({ tipo: 'donacion', documento: '', nombre: '', celular: '', correo: '', monto: '', justificacion: '', metodo: 'Efectivo', usuario: null }); await loadData() }

  return <main className="income-page"><h1>Ingresos financieros</h1><div className="income-tabs"><button className={tab === 'rentals' ? 'active' : ''} onClick={() => setTab('rentals')}>Alquiler de recursos</button><button className={tab === 'donations' ? 'active' : ''} onClick={() => setTab('donations')}>Donaciones y cuotas</button></div>
    {tab === 'rentals' ? <>
      <section className="income-card"><h2>Nuevo alquiler de recursos</h2><form onSubmit={createRental}><div className="income-grid"><label>Tipo<select value={renter.tipo} onChange={e => changeRenterType(e.target.value)}><option value="afiliado">Afiliado</option><option value="externo">Externo</option><option value="comunal">Comunal</option></select></label><label>Documento<input value={renter.documento} onChange={e => updateRenter('documento', e.target.value)} /><button type="button" onClick={() => lookupUser(renter.documento, 'renter')}>Buscar CC</button></label><label>Nombres<input required value={renter.nombres} onChange={e => updateRenter('nombres', e.target.value)} /></label><label>Apellidos<input value={renter.apellidos} onChange={e => updateRenter('apellidos', e.target.value)} /></label><label>Dirección<input value={renter.direccion} onChange={e => updateRenter('direccion', e.target.value)} /></label><label>Celular<input value={renter.celular} onChange={e => updateRenter('celular', e.target.value)} /></label><label>Correo<input type="email" value={renter.correo} onChange={e => updateRenter('correo', e.target.value)} /></label><label>Inicio<input type="date" required value={rentalForm.inicio} onChange={e => setRentalForm({ ...rentalForm, inicio: e.target.value })} /></label><label>Fin<input type="date" required value={rentalForm.fin} onChange={e => setRentalForm({ ...rentalForm, fin: e.target.value })} /></label><label>Depósito de garantía<input type="number" min="0" value={rentalForm.exonerado ? '0' : rentalForm.deposito} disabled={rentalForm.exonerado} onChange={e => setRentalForm({ ...rentalForm, deposito: e.target.value })} />{rentalForm.exonerado && <small className="form-helper">Una exoneración no requiere depósito de garantía.</small>}</label></div><h3>Recursos</h3><div className="resource-list">{resources.map(resource => <label className="resource-row" key={resource.id}><span><b>{resource.nombre}</b><small>Cantidad total: {resource.cantidad} · Valor unitario: {money(resource.valor_alquiler)}</small></span><input type="number" min="0" max={resource.cantidad} value={quantities[resource.id] || ''} onChange={e => setQuantities({ ...quantities, [resource.id]: e.target.value })} /></label>)}</div><label>Cláusulas de uso<textarea required value={rentalForm.clausulas} onChange={e => setRentalForm({ ...rentalForm, clausulas: e.target.value })} /></label><label className="check"><input type="checkbox" checked={rentalForm.exonerado} disabled={renter.tipo === 'externo' || (renter.tipo === 'afiliado' && renter.usuario === null)} onChange={e => setRentalForm(current => ({ ...current, exonerado: e.target.checked, deposito: e.target.checked ? '0' : current.deposito, justificacion: e.target.checked ? current.justificacion : '' }))} /> Exonerar pago</label>{renter.tipo === 'externo' && <small className="form-helper">Los arrendatarios externos deben realizar el pago del alquiler.</small>}{renter.tipo === 'afiliado' && renter.usuario === null && <small className="form-helper">Busca y selecciona un afiliado activo para habilitar la exoneración.</small>}{rentalForm.exonerado && <label>Justificación de la exoneración *<textarea required value={rentalForm.justificacion} onChange={e => setRentalForm({ ...rentalForm, justificacion: e.target.value })} /><small className="form-helper">La justificación quedará registrada como soporte de la exoneración.</small></label>}<button disabled={busy}>{busy ? 'Guardando...' : 'Crear alquiler'}</button></form></section>
      <section className="income-card"><h2>Alquileres registrados</h2>{rentals.map(rental => <article className="income-row" key={rental.id}><div><b>#{rental.id} · {rental.nombres} {rental.apellidos || ''}</b><span>{rental.numero_documento} · {rental.fecha_inicio} → {rental.fecha_fin}</span><span>Valor: {money(rental.valor_alquiler)} · Garantía: {money(rental.deposito_garantia)}</span><span>Pago: {rental.estado_pago} · Alquiler: {rental.estado_alquiler} · Depósito: {rental.estado_deposito}</span></div><div className="row-actions"><button onClick={() => downloadRentalVoucher({ ...rental, items: rental.komerizo_alquiler_recursos_items })}>Comprobante / cláusulas</button>{rental.estado_pago === 'pendiente' && rental.estado_alquiler === 'pendiente' && <button onClick={() => { setPaymentRental(rental); setMethod('Efectivo') }}>Confirmar pago</button>}{rental.estado_alquiler === 'pendiente' && !rental.tesoreria_movimiento_id && <button onClick={() => cancelRental(rental.id)}>Cancelar</button>}{rental.estado_alquiler === 'activo' && <button onClick={() => setCloseRental({ ...rental, damage: false, observation: '' })}>Cerrar alquiler</button>}{rental.tesoreria_movimiento_id && <button onClick={async () => { const { data } = await supabase.from('komerizo_tesoreria').select('*').eq('id', rental.tesoreria_movimiento_id).single(); if (data) downloadTreasuryReceipt({ ...data, renter: `${rental.nombres} ${rental.apellidos || ''}`, numero_documento: rental.numero_documento, deposito_garantia: rental.deposito_garantia, responsable: `${user?.nombre || ''} ${user?.apellido || ''}`.trim() }) }}>Descargar recibo</button>}</div></article>)}</section>
    </> : <section className="income-card"><h2>Donaciones y cuotas</h2><form onSubmit={createDonation}><div className="income-grid"><label>Tipo<select value={donation.tipo} onChange={e => setDonation({ ...donation, tipo: e.target.value })}><option value="donacion">Donación</option><option value="cuota">Cuota de asociado</option></select></label><label>Documento<input value={donation.documento} onChange={e => setDonation({ ...donation, documento: e.target.value })} /><button type="button" onClick={() => lookupUser(donation.documento, 'donation')}>Buscar CC</button></label><label>Nombre<input required value={donation.nombre} onChange={e => setDonation({ ...donation, nombre: e.target.value })} /></label><label>Celular<input value={donation.celular} onChange={e => setDonation({ ...donation, celular: e.target.value })} /></label><label>Correo<input type="email" value={donation.correo} onChange={e => setDonation({ ...donation, correo: e.target.value })} /></label><label>Monto<input required type="number" min="0.01" step="0.01" value={donation.monto} onChange={e => setDonation({ ...donation, monto: e.target.value })} /></label><label>Método de pago<select value={donation.metodo} onChange={e => setDonation({ ...donation, metodo: e.target.value })}>{paymentMethods.map(item => <option key={item}>{item}</option>)}</select></label></div><label>Justificación<textarea required value={donation.justificacion} onChange={e => setDonation({ ...donation, justificacion: e.target.value })} /></label><button disabled={busy}>Registrar ingreso</button></form><h2>Historial</h2>{donations.map(item => <article className="income-row" key={item.id}><div><b>{item.created_at?.slice(0, 10)} · {item.tipo === 'donacion' ? 'Donación' : 'Cuota'}</b><span>{item.nombre_persona} · {item.numero_documento || '-'}</span><span>{money(item.monto)} · {item.metodo_pago}</span><span>{item.justificacion}</span></div>{item.tesoreria_movimiento_id && <button onClick={async () => { const { data } = await supabase.from('komerizo_tesoreria').select('*').eq('id', item.tesoreria_movimiento_id).single(); if (data) downloadTreasuryReceipt({ ...data, pagador: item.nombre_persona, documento: item.numero_documento, responsable: `${user?.nombre || ''} ${user?.apellido || ''}`.trim() }) }}>Descargar recibo</button>}</article>)}</section>}
    {paymentRental && <div className="income-modal"><div className="modal-box"><h2>Confirmar pago</h2><select value={method} onChange={e => setMethod(e.target.value)}>{paymentMethods.map(item => <option key={item}>{item}</option>)}</select><button onClick={payRental}>Confirmar</button><button onClick={() => setPaymentRental(null)}>Cancelar</button></div></div>}
    {closeRental && <div className="income-modal"><div className="modal-box"><h2>Cerrar alquiler</h2><label className="check"><input type="checkbox" checked={closeRental.damage} onChange={e => setCloseRental({ ...closeRental, damage: e.target.checked })} /> ¿Hubo daños?</label><textarea placeholder="Observación" value={closeRental.observation} onChange={e => setCloseRental({ ...closeRental, observation: e.target.value })} /><button onClick={closeRentalAction}>Cerrar</button><button onClick={() => setCloseRental(null)}>Cancelar</button></div></div>}
  </main>
}
