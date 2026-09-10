/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { downloadBonusReport, downloadBonusVoucher } from '@/lib/financialReceipts'
import './bonos.css'

const methods = ['Efectivo', 'Transferencia', 'Cheque', 'Otro']
const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value) || 0)
type Modal = { kind: 'pago'; compra: any } | { kind: 'cierre'; bono: any } | null
type Buyer = { id: number | null; documento: string; nombre: string; celular: string; correo: string }
const emptyBuyer = (): Buyer => ({ id: null, documento: '', nombre: '', celular: '', correo: '' })

export default function BonosPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'bonos' | 'compra' | 'buscar'>('bonos')
  const [roleId, setRoleId] = useState<number | null>(null)
  const [bonos, setBonos] = useState<any[]>([])
  const [compras, setCompras] = useState<any[]>([])
  const [occupied, setOccupied] = useState<any[]>([])
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [method, setMethod] = useState('Efectivo')
  const [winner, setWinner] = useState('')
  const [search, setSearch] = useState('')
  const [searchRows, setSearchRows] = useState<any[]>([])
  const [bonusForm, setBonusForm] = useState({ nombre: '', descripcion: '', puestos: '', valor: '', premio: '', fecha: '' })
  const [buyerType, setBuyerType] = useState<'afiliado' | 'externo'>('externo')
  const [buyer, setBuyer] = useState<Buyer>(emptyBuyer())
  const [selectedBonus, setSelectedBonus] = useState<number | null>(null)
  const [selectedPositions, setSelectedPositions] = useState<number[]>([])
  const [purchaseState, setPurchaseState] = useState('pagado')
  const [purchaseMethod, setPurchaseMethod] = useState('Efectivo')

  const loadData = async () => {
    const [{ data: role }, { data: bonusRows }, { data: purchaseRows }, { data: positionRows }] = await Promise.all([
      supabase.from('komerizo_roles').select('id').eq('nombre', 'Tesorero').single(),
      supabase.from('komerizo_bonos_solidarios').select('*').order('fecha_actividad', { ascending: false }),
      supabase.from('komerizo_bono_compras').select('*').order('fecha_registro', { ascending: false }),
      supabase.from('komerizo_bono_puestos_ocupados').select('*'),
    ])
    if (role) setRoleId(role.id)
    setBonos(bonusRows || [])
    setCompras(purchaseRows || [])
    setOccupied(positionRows || [])
  }
  useEffect(() => { if (user?.id) loadData() }, [user?.id])
  const openBonos = useMemo(() => bonos.filter(bono => bono.estado === 'abierto'), [bonos])
  const selectedBonusRow = bonos.find(bono => bono.id === selectedBonus) || null
  const occupiedFor = (bonoId: number) => occupied.filter(item => item.bono_id === bonoId)
  const purchaseFor = (bonoId: number) => compras.filter(item => item.bono_id === bonoId)
  const stateForPosition = (bonoId: number, position: number) => { const row = occupiedFor(bonoId).find(item => item.numero_puesto === position); return row ? compras.find(compra => compra.id === row.compra_id)?.estado || 'ocupado' : 'disponible' }

  const createBonus = async (event: FormEvent) => {
    event.preventDefault(); if (!user?.id || !roleId) return; setBusy(true)
    const { error } = await supabase.rpc('komerizo_crear_bono_solidario', { p_nombre: bonusForm.nombre, p_descripcion: bonusForm.descripcion, p_cantidad_puestos: Number(bonusForm.puestos), p_valor_puesto: Number(bonusForm.valor), p_valor_premio: Number(bonusForm.premio), p_fecha_actividad: bonusForm.fecha, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); setBusy(false)
    if (error) alert(error.message); else { setBonusForm({ nombre: '', descripcion: '', puestos: '', valor: '', premio: '', fecha: '' }); await loadData() }
  }
  const lookupBuyer = async () => {
    const { data } = await supabase.from('komerizo_usuarios').select('id,cc,nombre,apellido,telefono,correo_electronico').eq('cc', buyer.documento.trim()).maybeSingle(); if (!data) { alert('No se encontró el afiliado.'); return }
    setBuyer({ id: data.id, documento: data.cc, nombre: `${data.nombre} ${data.apellido || ''}`.trim(), celular: data.telefono || '', correo: data.correo_electronico || '' })
  }
  const registerPurchase = async (event: FormEvent) => {
    event.preventDefault(); if (buyerType === 'afiliado' && buyer.id == null) { alert('Debes buscar y seleccionar un afiliado válido antes de registrar la compra.'); return }
    if (!user?.id || !roleId || !selectedBonus || !selectedPositions.length) { alert('Selecciona el bono y los puestos.'); return }; setBusy(true)
    const { data: id, error } = await supabase.rpc('komerizo_registrar_compra_bono', { p_bono_id: selectedBonus, p_comprador_usuario_id: buyerType === 'afiliado' ? buyer.id : null, p_numero_documento: buyer.documento, p_nombre_comprador: buyer.nombre, p_celular: buyer.celular, p_correo: buyer.correo, p_puestos: selectedPositions, p_estado_inicial: purchaseState, p_metodo_pago: purchaseState === 'pagado' ? purchaseMethod : null, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); setBusy(false)
    if (error) { alert(error.message); return }; const { data: row } = await supabase.from('komerizo_bono_compras').select('*').eq('id', id).single(); if (row) downloadBonusVoucher({ ...row, bono_nombre: selectedBonusRow?.nombre }, purchaseState === 'pagado' ? 'pago' : 'reserva'); setSelectedPositions([]); await loadData()
  }
  const payReservation = async () => { if (!modal || modal.kind !== 'pago' || !user?.id || !roleId) return; setBusy(true); const { data, error } = await supabase.rpc('komerizo_pagar_reserva_bono', { p_compra_id: modal.compra.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId, p_metodo_pago: method }); setBusy(false); if (error) alert(error.message); else { setModal(null); await loadData(); downloadBonusVoucher({ ...modal.compra, estado: 'pagado', metodo_pago: method, tesoreria_movimiento_id: data, bono_nombre: modal.compra.bono_nombre || bonos.find(b => b.id === modal.compra.bono_id)?.nombre }, 'pago') } }
  const cancelReservation = async (compra: any) => { if (!user?.id || !roleId || !confirm('¿Cancelar esta reserva?')) return; const { error } = await supabase.rpc('komerizo_cancelar_reserva_bono', { p_compra_id: compra.id, p_tesorero_id: user.id, p_tesorero_rol_id: roleId }); if (error) alert(error.message); else await loadData() }
  const closeBonus = async () => { if (!modal || modal.kind !== 'cierre' || !user?.id || !roleId || !winner) return; const state = stateForPosition(modal.bono.id, Number(winner)); if (state !== 'pagado' && !method) return; setBusy(true); const { error } = await supabase.rpc('komerizo_cerrar_bono_solidario', { p_bono_id: modal.bono.id, p_puesto_ganador: Number(winner), p_tesorero_id: user.id, p_tesorero_rol_id: roleId, p_metodo_registro_premio: state === 'pagado' ? null : method }); setBusy(false); if (error) alert(error.message); else { setModal(null); setWinner(''); await loadData() } }
  const searchPurchases = async (event: FormEvent) => { event.preventDefault(); const { data, error } = await supabase.from('komerizo_bono_compras').select('*,komerizo_bonos_solidarios(nombre)').eq('numero_documento', search.trim()).order('fecha_registro', { ascending: false }); if (error) alert(error.message); else setSearchRows(data || []) }

  return <main className="bonos-page"><h1>Bono solidario</h1><nav className="bonos-tabs"><button className={tab === 'bonos' ? 'active' : ''} onClick={() => setTab('bonos')}>Bonos</button><button className={tab === 'compra' ? 'active' : ''} onClick={() => setTab('compra')}>Registrar compra</button><button className={tab === 'buscar' ? 'active' : ''} onClick={() => setTab('buscar')}>Buscar comprobante</button></nav>
    {tab === 'bonos' && <><section className="bono-card"><h2>Crear bono</h2><form className="bono-form" onSubmit={createBonus}><label>Nombre<input required value={bonusForm.nombre} onChange={e => setBonusForm({ ...bonusForm, nombre: e.target.value })} /></label><label>Descripción<textarea value={bonusForm.descripcion} onChange={e => setBonusForm({ ...bonusForm, descripcion: e.target.value })} /></label><label>Cantidad de puestos<input required type="number" min="1" value={bonusForm.puestos} onChange={e => setBonusForm({ ...bonusForm, puestos: e.target.value })} /></label><label>Valor por puesto<input required type="number" min="0.01" value={bonusForm.valor} onChange={e => setBonusForm({ ...bonusForm, valor: e.target.value })} /></label><label>Valor del premio<input required type="number" min="0.01" value={bonusForm.premio} onChange={e => setBonusForm({ ...bonusForm, premio: e.target.value })} /></label><label>Fecha de la actividad<input required type="date" value={bonusForm.fecha} onChange={e => setBonusForm({ ...bonusForm, fecha: e.target.value })} /></label><button disabled={busy}>Crear bono</button></form></section>{bonos.map(bono => <BonusCard key={bono.id} bono={bono} compras={purchaseFor(bono.id)} stateForPosition={stateForPosition} onClose={() => { setWinner(''); setMethod('Efectivo'); setModal({ kind: 'cierre', bono }) }} onPay={(compra: any) => { setMethod('Efectivo'); setModal({ kind: 'pago', compra }) }} onCancel={cancelReservation} />)}</>}
    {tab === 'compra' && <section className="bono-card"><h2>Registrar compra</h2><form className="bono-form" onSubmit={registerPurchase}><label>Bono abierto<select required value={selectedBonus || ''} onChange={e => { setSelectedBonus(Number(e.target.value) || null); setSelectedPositions([]) }}><option value="">Selecciona un bono</option>{openBonos.map(bono => <option key={bono.id} value={bono.id}>{bono.nombre} · {money(bono.valor_puesto)}</option>)}</select></label><label>Tipo de comprador<select value={buyerType} onChange={e => { setBuyerType(e.target.value as 'afiliado' | 'externo'); setBuyer(emptyBuyer()) }}><option value="afiliado">Afiliado</option><option value="externo">Externo</option></select></label><label>Número de documento<input required value={buyer.documento} onChange={e => setBuyer({ ...buyer, documento: e.target.value, id: null })} />{buyerType === 'afiliado' && <button type="button" onClick={lookupBuyer}>Buscar CC</button>}</label><label>Nombre del comprador<input required value={buyer.nombre} onChange={e => setBuyer({ ...buyer, nombre: e.target.value })} /></label><label>Celular<input value={buyer.celular} onChange={e => setBuyer({ ...buyer, celular: e.target.value })} /></label><label>Correo<input type="email" value={buyer.correo} onChange={e => setBuyer({ ...buyer, correo: e.target.value })} /></label><label>Estado inicial<select value={purchaseState} onChange={e => setPurchaseState(e.target.value)}><option value="pagado">Pagado</option><option value="reservado">Reservado</option></select></label>{purchaseState === 'pagado' && <label>Método de pago<select value={purchaseMethod} onChange={e => setPurchaseMethod(e.target.value)}>{methods.map(item => <option key={item}>{item}</option>)}</select></label>}{selectedBonusRow && <PositionGrid bono={selectedBonusRow} stateForPosition={stateForPosition} selected={selectedPositions} setSelected={setSelectedPositions} />}<button type="submit" disabled={busy || !selectedPositions.length}>Registrar compra</button></form></section>}
    {tab === 'buscar' && <section className="bono-card"><h2>Buscar comprobante</h2><form className="search-form" onSubmit={searchPurchases}><label>Número de documento<input required value={search} onChange={e => setSearch(e.target.value)} /></label><button>Buscar</button></form>{searchRows.map(row => <PurchaseRow key={row.id} compra={row} bonusName={row.komerizo_bonos_solidarios?.nombre} onPay={(compra: any) => { setMethod('Efectivo'); setModal({ kind: 'pago', compra }) }} onCancel={cancelReservation} />)}</section>}
    {modal?.kind === 'pago' && <div className="bono-modal"><div className="bono-modal-card"><h2>Registrar pago</h2><p>Compra #{modal.compra.id} · {money(modal.compra.total)}</p><select value={method} onChange={e => setMethod(e.target.value)}>{methods.map(item => <option key={item}>{item}</option>)}</select><button onClick={payReservation} disabled={busy}>Confirmar</button><button onClick={() => setModal(null)}>Cancelar</button></div></div>}
    {modal?.kind === 'cierre' && <div className="bono-modal"><div className="bono-modal-card"><h2>Cerrar bono: {modal.bono.nombre}</h2><label>Puesto ganador<select value={winner} onChange={e => setWinner(e.target.value)}><option value="">Selecciona</option>{Array.from({ length: modal.bono.cantidad_puestos }, (_, index) => index + 1).map(position => <option key={position} value={position}>{position} · {stateForPosition(modal.bono.id, position)}</option>)}</select></label>{winner && stateForPosition(modal.bono.id, Number(winner)) !== 'pagado' && <><p className="warning">El puesto ganador no está pagado. El premio no será entregado y su valor será registrado como ingreso de la Junta.</p><label>Método de registro<select value={method} onChange={e => setMethod(e.target.value)}>{methods.map(item => <option key={item}>{item}</option>)}</select></label></>}<button onClick={closeBonus} disabled={busy || !winner}>Cerrar bono</button><button onClick={() => setModal(null)}>Cancelar</button></div></div>}
  </main>
}

function PositionGrid({ bono, stateForPosition, selected, setSelected }: any) { const counts = { pagado: 0, reservado: 0, disponible: 0 }; return <div className="position-grid-wrap"><div className="position-counters">{Array.from({ length: bono.cantidad_puestos }, (_, index) => index + 1).map(position => { const state = stateForPosition(bono.id, position); if (state in counts) counts[state as keyof typeof counts]++; return null })}<span>Pagados: {counts.pagado}</span><span>Reservados: {counts.reservado}</span><span>Disponibles: {counts.disponible}</span></div><div className="position-grid">{Array.from({ length: bono.cantidad_puestos }, (_, index) => index + 1).map(position => { const state = stateForPosition(bono.id, position); const available = state === 'disponible'; return <button type="button" key={position} disabled={!available} title={`${position}: ${state}`} className={`position ${state} ${selected.includes(position) ? 'selected' : ''}`} onClick={() => setSelected(selected.includes(position) ? selected.filter((item: number) => item !== position) : [...selected, position])}>{position}<small>{state}</small></button> })}</div></div> }
function PurchaseRow({ compra, bonusName, onPay, onCancel }: any) { const voucher = { ...compra, bono_nombre: compra.bono_nombre ?? bonusName ?? compra.komerizo_bonos_solidarios?.nombre }; return <article className="purchase-row"><div><b>#{compra.id} · {compra.nombre_comprador}</b><span>{voucher.bono_nombre || '-'} · Puestos: {(compra.puestos || []).join(', ')}</span><span>{money(compra.total)} · Estado: {compra.estado}</span></div><div>{compra.estado === 'pagado' && <button onClick={() => downloadBonusVoucher(voucher, 'pago')}>Reimprimir comprobante de pago</button>}{compra.estado === 'reservado' && <><button onClick={() => onPay(voucher)}>Registrar pago</button><button onClick={() => onCancel(compra)}>Cancelar</button><button onClick={() => downloadBonusVoucher(voucher, 'reserva')}>Reimprimir reserva</button></>}{compra.estado === 'cancelado' && <span>Reserva cancelada</span>}</div></article> }
function BonusCard({ bono, compras, stateForPosition, onClose, onPay, onCancel }: any) { return <section className="bono-card"><div className="bono-heading"><div><h2>{bono.nombre}</h2><p>{bono.descripcion}</p><p>Actividad: {bono.fecha_actividad} · Premio: {money(bono.valor_premio)} · Estado: {bono.estado}</p></div>{bono.estado === 'abierto' ? <button onClick={onClose}>Cerrar bono</button> : <button onClick={() => downloadBonusReport(bono)}>Descargar reporte</button>}</div><PositionGrid bono={bono} stateForPosition={stateForPosition} selected={[]} setSelected={() => undefined} /><h3>Compras</h3>{compras.map((compra: any) => <PurchaseRow key={compra.id} compra={compra} bonusName={bono.nombre} onPay={onPay} onCancel={onCancel} />)}</section> }
