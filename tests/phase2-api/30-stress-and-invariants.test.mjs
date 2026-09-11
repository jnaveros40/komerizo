import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { supabase } from './supabase.mjs'
import { context, setupPhase2Fixtures, cleanupPhase2Fixtures } from './fixtures.mjs'
import { assertNoSupabaseError, expectRpcFailure, expectRpcSuccess, getCurrentBalance, getRow, money, dateLocalString } from './helpers.mjs'
import { record, writeReport } from './reporter.mjs'

const state = { expectedBalance: null, inventory: {}, salonConfig: null }

function pushUnique(bucket, values) {
  const target = context.created[bucket]
  if (!target) throw new Error(`Unknown created bucket: ${bucket}`)
  for (const value of Array.isArray(values) ? values : [values]) {
    if (value !== null && value !== undefined && !target.includes(value)) target.push(value)
  }
}

async function registerMovement(id) {
  if (!id) return
  pushUnique('treasuryMovements', Number(id))
  const history = assertNoSupabaseError(await supabase.from('komerizo_tesoreria_historial').select('id').eq('movimiento_id', id), `Register movement history ${id}`)
  pushUnique('treasuryHistory', (history ?? []).map((row) => row.id))
}

async function registerAuthorization(id) {
  pushUnique('authorizations', Number(id))
  const history = assertNoSupabaseError(await supabase.from('komerizo_autorizaciones_gasto_historial').select('id').eq('autorizacion_id', id), `Register auth history ${id}`)
  pushUnique('authorizationHistory', (history ?? []).map((row) => row.id))
}

async function registerResourceRental(id) {
  pushUnique('resourceRentals', Number(id))
  const items = assertNoSupabaseError(await supabase.from('komerizo_alquiler_recursos_items').select('id').eq('alquiler_id', id), `Register rental items ${id}`)
  pushUnique('resourceRentalItems', (items ?? []).map((row) => row.id))
  const row = await getRow('komerizo_alquiler_recursos', id)
  if (row?.tesoreria_movimiento_id) await registerMovement(row.tesoreria_movimiento_id)
  if (row?.deposito_movimiento_id) await registerMovement(row.deposito_movimiento_id)
  return row
}

async function registerSalonRental(id) {
  pushUnique('salonRentals', Number(id))
  const items = assertNoSupabaseError(await supabase.from('komerizo_alquiler_items').select('id').eq('alquiler_id', id), `Register Salon items ${id}`)
  pushUnique('salonRentalItems', (items ?? []).map((row) => row.id))
  const row = await getRow('komerizo_alquileres', id)
  if (row?.tesoreria_movimiento_id) await registerMovement(row.tesoreria_movimiento_id)
  return row
}

async function registerSale(id) {
  pushUnique('sales', Number(id))
  const row = await getRow('komerizo_ventas_actividad', id)
  if (row?.tesoreria_movimiento_id) await registerMovement(row.tesoreria_movimiento_id)
  return row
}

async function registerBonusPurchase(id) {
  pushUnique('bonusPurchases', Number(id))
  const row = await getRow('komerizo_bono_compras', id)
  if (row?.tesoreria_movimiento_id) await registerMovement(row.tesoreria_movimiento_id)
  const occupancy = assertNoSupabaseError(await supabase.from('komerizo_bono_puestos_ocupados').select('bono_id,numero_puesto').eq('compra_id', id), `Register Bonus occupancy ${id}`)
  for (const entry of occupancy ?? []) pushUnique('bonusOccupancy', entry)
  return row
}

async function checkedStep(t, scenario, step, expected, action) {
  const started = Date.now()
  await t.test(step, async () => {
    try {
      const actual = await action()
      record({ scenario, step, status: 'passed', expected, actual: typeof actual === 'string' ? actual : 'Condition satisfied', duration: Date.now() - started })
    } catch (error) {
      record({ scenario, step, status: 'failed', expected, actual: 'Condition failed', error, duration: Date.now() - started })
      throw error
    }
  })
}

function addDaysString(days) { const d = new Date(); d.setDate(d.getDate() + days); return dateLocalString(d) }
function timeToMinutes(value) { const [h,m] = String(value).split(':').map(Number); return h * 60 + m }
function minutesToTime(v) { return `${String(Math.floor(v/60)).padStart(2,'0')}:${String(v%60).padStart(2,'0')}:00` }

async function createInventory(name, quantity, rentalValue) {
  const row = assertNoSupabaseError(await supabase.from('komerizo_inventario').insert({
    nombre: `${context.runId} ${name}`, descripcion: `Stress fixture ${context.runId}`, cantidad: quantity, unidad: 'unidades',
    valor_unitario: 0, categoria: 'Prueba Phase 2', estado: 'activo', es_alquilable: true, valor_alquiler: rentalValue,
  }).select().single(), `Create stress inventory ${name}`)
  pushUnique('inventory', row.id)
  return row
}

async function createRegisteredExpense(amount, label) {
  const authId = Number(await expectRpcSuccess('komerizo_crear_solicitud_egreso_presidencia', {
    p_presidente_id: context.users.president.id, p_presidente_rol_id: context.roles.Presidente, p_fecha_egreso: dateLocalString(), p_monto: amount,
    p_concepto: `${context.runId} ${label}`, p_beneficiario_destino: 'Proveedor stress', p_metodo_pago: 'Transferencia',
    p_justificacion: 'Fixture stress', p_archivo_adjunto_url: null, p_organo_responsable: null, p_numero_acta: null,
  }))
  await registerAuthorization(authId)
  return authId
}

function rpcResults(results) {
  return results.map((result) => ({ ok: !result.error, data: result.data, error: result.error?.message ?? null }))
}

function assertOneSuccessOneFailure(results, label) {
  const normalized = rpcResults(results)
  assert.equal(normalized.filter((r) => r.ok).length, 1, `${label}: expected exactly one success: ${JSON.stringify(normalized)}`)
  assert.equal(normalized.filter((r) => !r.ok).length, 1, `${label}: expected exactly one failure: ${JSON.stringify(normalized)}`)
  return normalized.find((r) => r.ok)
}

async function balance() { return money((await getCurrentBalance()).saldo_actual) }

after(async () => {
  try { if (context.created.users.length || context._setupComplete) await cleanupPhase2Fixtures() }
  finally { writeReport() }
})

test('Phase 2 stress/concurrency API scenarios M', async (t) => {
  await setupPhase2Fixtures()
  state.expectedBalance = money(context.baseline.treasuryBalance.saldo_actual)
  state.inventory.chair = await createInventory('Stress silla', 2, 5000)
  state.salonConfig = assertNoSupabaseError(await supabase.from('komerizo_salon_config').select('*').eq('estado','activo').order('id',{ascending:false}).limit(1).maybeSingle(), 'Read active Salon config')
  assert.ok(state.salonConfig, 'No existe configuración activa del salón para stress tests')
  const treasurer = context.users.treasurer
  const affiliate = context.users.affiliate1
  const roles = context.roles

  await checkedStep(t, 'M — Stress and concurrency', 'M1 — Double Treasurer expense registration', 'Concurrent registration creates exactly one movement and one balance decrement', async () => {
    const authId = await createRegisteredExpense(90000, 'M1 concurrent expense')
    const before = await balance()
    const params = { p_autorizacion_id: authId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero }
    const results = await Promise.all([supabase.rpc('komerizo_registrar_egreso_autorizado', params), supabase.rpc('komerizo_registrar_egreso_autorizado', params)])
    assertOneSuccessOneFailure(results, 'M1')
    const movements = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id,cantidad').eq('autorizacion_gasto_id', authId), 'M1 movement count')
    assert.equal(movements.length, 1)
    await registerMovement(movements[0].id); await registerAuthorization(authId)
    state.expectedBalance = money(before - 90000)
    assert.equal(await balance(), state.expectedBalance)
    return `Exactly one movement ${movements[0].id}`
  })

  await checkedStep(t, 'M — Stress and concurrency', 'M2 — Double physical-rental payment', 'Two simultaneous payments produce one income only', async () => {
    const rentalId = Number(await expectRpcSuccess('komerizo_crear_alquiler_recursos', {
      p_creado_por: treasurer.id, p_rol_creador_id: roles.Tesorero, p_tipo_arrendatario: 'externo', p_usuario_arrendatario_id: null,
      p_numero_documento: `M2-${context.runId}`, p_nombres: 'Concurrente', p_apellidos: 'Alquiler', p_direccion: '-', p_celular: '-', p_correo: '',
      p_fecha_inicio: addDaysString(300), p_fecha_fin: addDaysString(300), p_deposito_garantia: 0, p_clausulas_uso: 'Stress', p_exonerado_pago: false, p_justificacion_exoneracion: null,
      p_items: [{ inventario_id: state.inventory.chair.id, cantidad: 1 }],
    }))
    await registerResourceRental(rentalId)
    const before = await balance()
    const params = { p_alquiler_id: rentalId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_pago: 'Efectivo' }
    const results = await Promise.all([supabase.rpc('komerizo_confirmar_pago_alquiler_recursos', params), supabase.rpc('komerizo_confirmar_pago_alquiler_recursos', params)])
    assertOneSuccessOneFailure(results, 'M2')
    const rows = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id,cantidad').eq('origen_tipo','alquiler_recursos').eq('origen_id',rentalId), 'M2 movement count')
    assert.equal(rows.length,1); await registerMovement(rows[0].id); await registerResourceRental(rentalId)
    state.expectedBalance = money(before + 5000); assert.equal(await balance(), state.expectedBalance)
    return 'One rental income created'
  })

  await checkedStep(t, 'M — Stress and concurrency', 'M3 — Double Salon payment', 'Two simultaneous Salon payments create one income only', async () => {
    const date = addDaysString(310); const open = timeToMinutes(state.salonConfig.hora_apertura)
    const salonId = Number(await expectRpcSuccess('komerizo_crear_reserva_salon', {
      p_usuario_id: affiliate.id, p_rol_id: roles.Usuario, p_tipo_alquiler: 'por_hora', p_fecha_inicio: date, p_fecha_fin: date,
      p_hora_inicio: minutesToTime(open), p_hora_fin: minutesToTime(open+60), p_motivo: `${context.runId} M3 Salon`, p_items: [],
    }))
    const rowBefore = await registerSalonRental(salonId); const before = await balance()
    const params = { p_alquiler_id: salonId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_pago: 'Efectivo' }
    const results = await Promise.all([supabase.rpc('komerizo_confirmar_pago_salon',params), supabase.rpc('komerizo_confirmar_pago_salon',params)])
    assertOneSuccessOneFailure(results,'M3')
    const rows = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('origen_tipo','salon').eq('origen_id',salonId), 'M3 movement count')
    assert.equal(rows.length,1); await registerMovement(rows[0].id); await registerSalonRental(salonId)
    state.expectedBalance = money(before + money(rowBefore.valor_total)); assert.equal(await balance(),state.expectedBalance)
    state.paidSalonId = salonId
    return 'One Salon payment movement created'
  })

  const salesExpenseAuth = await createRegisteredExpense(70000, 'M sales expense')
  const salesExpenseMove = Number(await expectRpcSuccess('komerizo_registrar_egreso_autorizado', { p_autorizacion_id: salesExpenseAuth, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero }))
  await registerMovement(salesExpenseMove); await registerAuthorization(salesExpenseAuth); state.expectedBalance = money(state.expectedBalance - 70000)

  await checkedStep(t, 'M — Stress and concurrency', 'M4 — Double product reservation payment', 'Two simultaneous payments of one reservation create one movement', async () => {
    const activityId = Number(await expectRpcSuccess('komerizo_crear_actividad_venta', {
      p_nombre: `${context.runId} M4 actividad`, p_producto_nombre: 'Producto M4', p_descripcion: 'Stress', p_cantidad_inicial: 10, p_precio_unitario: 10000,
      p_fecha_entrega: addDaysString(320), p_egresos: [salesExpenseMove], p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    pushUnique('salesActivities',activityId); pushUnique('activityExpenseLinks',{actividad_id:activityId,movimiento_tesoreria_id:salesExpenseMove})
    const saleId = Number(await expectRpcSuccess('komerizo_registrar_venta_producto', {
      p_actividad_id: activityId, p_comprador_usuario_id: affiliate.id, p_numero_documento: affiliate.cc, p_nombre_comprador: 'Juan', p_celular:'',p_correo:'',
      p_cantidad:2,p_estado_inicial:'reservada',p_metodo_pago:null,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero,
    }))
    await registerSale(saleId); const before=await balance()
    const params={p_venta_id:saleId,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero,p_metodo_pago:'Efectivo'}
    const results=await Promise.all([supabase.rpc('komerizo_pagar_reserva_producto',params),supabase.rpc('komerizo_pagar_reserva_producto',params)])
    assertOneSuccessOneFailure(results,'M4')
    const sale=await registerSale(saleId); assert.equal(sale.estado,'pagada')
    const rows=assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('origen_tipo','venta_producto').eq('origen_id',saleId),'M4 movement count')
    assert.equal(rows.length,1); await registerMovement(rows[0].id)
    state.expectedBalance=money(before+20000); assert.equal(await balance(),state.expectedBalance)
    state.paidSaleId=saleId; state.salesActivityId=activityId
    return 'One product payment movement created'
  })

  await checkedStep(t, 'M — Stress and concurrency', 'M5 — Two buyers compete for last product unit', 'Only one reservation receives the final unit', async () => {
    const activityId=Number(await expectRpcSuccess('komerizo_crear_actividad_venta',{
      p_nombre:`${context.runId} last-unit`,p_producto_nombre:'Última unidad',p_descripcion:'Stress',p_cantidad_inicial:1,p_precio_unitario:9000,p_fecha_entrega:addDaysString(321),
      p_egresos:[salesExpenseMove],p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero,
    }))
    pushUnique('salesActivities',activityId); pushUnique('activityExpenseLinks',{actividad_id:activityId,movimiento_tesoreria_id:salesExpenseMove})
    const base={p_actividad_id:activityId,p_comprador_usuario_id:null,p_celular:'',p_correo:'',p_cantidad:1,p_estado_inicial:'reservada',p_metodo_pago:null,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero}
    const results=await Promise.all([
      supabase.rpc('komerizo_registrar_venta_producto',{...base,p_numero_documento:`A-${context.runId}`,p_nombre_comprador:'Buyer A'}),
      supabase.rpc('komerizo_registrar_venta_producto',{...base,p_numero_documento:`B-${context.runId}`,p_nombre_comprador:'Buyer B'}),
    ])
    const ok=assertOneSuccessOneFailure(results,'M5'); const saleId=Number(ok.data); await registerSale(saleId)
    const active=assertNoSupabaseError(await supabase.from('komerizo_ventas_actividad').select('id,cantidad,estado').eq('actividad_id',activityId).in('estado',['pagada','reservada','pendiente_pago']),'M5 allocation count')
    assert.equal(active.length,1); assert.equal(active.reduce((s,r)=>s+Number(r.cantidad),0),1)
    return `Final unit assigned once to sale ${saleId}`
  })

  await checkedStep(t, 'M — Stress and concurrency', 'M6 — Two buyers compete for same Bonus position', 'Only one purchase owns the position', async () => {
    const bonusId=Number(await expectRpcSuccess('komerizo_crear_bono_solidario',{p_nombre:`${context.runId} M6 Bono`,p_descripcion:'Stress',p_cantidad_puestos:5,p_valor_puesto:10000,p_valor_premio:100000,p_fecha_actividad:addDaysString(330),p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero}))
    pushUnique('bonuses',bonusId)
    const base={p_bono_id:bonusId,p_comprador_usuario_id:null,p_celular:'',p_correo:'',p_puestos:[1],p_estado_inicial:'reservado',p_metodo_pago:null,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero}
    const results=await Promise.all([
      supabase.rpc('komerizo_registrar_compra_bono',{...base,p_numero_documento:`BA-${context.runId}`,p_nombre_comprador:'Bonus A'}),
      supabase.rpc('komerizo_registrar_compra_bono',{...base,p_numero_documento:`BB-${context.runId}`,p_nombre_comprador:'Bonus B'}),
    ])
    const ok=assertOneSuccessOneFailure(results,'M6'); const purchaseId=Number(ok.data); await registerBonusPurchase(purchaseId)
    const occupancy=assertNoSupabaseError(await supabase.from('komerizo_bono_puestos_ocupados').select('*').eq('bono_id',bonusId).eq('numero_puesto',1),'M6 occupancy')
    assert.equal(occupancy.length,1)
    const payMove=Number(await expectRpcSuccess('komerizo_pagar_reserva_bono',{p_compra_id:purchaseId,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero,p_metodo_pago:'Efectivo'}))
    await registerMovement(payMove); const paid=await registerBonusPurchase(purchaseId); state.expectedBalance=money(state.expectedBalance+money(paid.total))
    state.bonusId=bonusId; state.paidBonusPurchaseId=purchaseId
    return `Position 1 owned once by purchase ${purchaseId}`
  })

  await checkedStep(t, 'M — Stress and concurrency', 'M7 — Competing identical Salon reservations', 'Advisory lock/overlap rule lets only one reservation succeed', async () => {
    const date=addDaysString(340); const open=timeToMinutes(state.salonConfig.hora_apertura)
    const params={p_usuario_id:affiliate.id,p_rol_id:roles.Usuario,p_tipo_alquiler:'por_hora',p_fecha_inicio:date,p_fecha_fin:date,p_hora_inicio:minutesToTime(open),p_hora_fin:minutesToTime(open+60),p_motivo:`${context.runId} M7`,p_items:[]}
    const results=await Promise.all([supabase.rpc('komerizo_crear_reserva_salon',params),supabase.rpc('komerizo_crear_reserva_salon',params)])
    const ok=assertOneSuccessOneFailure(results,'M7'); const salonId=Number(ok.data); await registerSalonRental(salonId)
    const rows=assertNoSupabaseError(await supabase.from('komerizo_alquileres').select('id').eq('fecha_inicio',date).eq('motivo',`${context.runId} M7`).eq('estado','confirmado'),'M7 reservations')
    assert.equal(rows.length,1)
    return `One Salon reservation ${salonId} survived the race`
  })

  await checkedStep(t, 'M — Stress and concurrency', 'M8 — Invalid transitions do not mutate accounting', 'Registered/paid/closed entities reject obsolete transitions and balance stays fixed', async () => {
    const before=await balance()
    await expectRpcFailure('komerizo_corregir_solicitud_egreso_presidencia',{
      p_autorizacion_id:salesExpenseAuth,p_presidente_id:context.users.president.id,p_presidente_rol_id:roles.Presidente,p_fecha_egreso:dateLocalString(),p_monto:70000,
      p_concepto:`${context.runId} invalid correction`,p_beneficiario_destino:'X',p_metodo_pago:'Efectivo',p_justificacion:'X',p_archivo_adjunto_url:null,p_organo_responsable:null,p_numero_acta:null,p_comentario:'invalid',
    })
    await expectRpcFailure('komerizo_cancelar_reserva_producto',{p_venta_id:state.paidSaleId,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero})
    await expectRpcFailure('komerizo_pagar_reserva_producto',{p_venta_id:state.paidSaleId,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero,p_metodo_pago:'Efectivo'})
    await expectRpcFailure('komerizo_cancelar_reserva_bono',{p_compra_id:state.paidBonusPurchaseId,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero})
    await expectRpcFailure('komerizo_pagar_reserva_bono',{p_compra_id:state.paidBonusPurchaseId,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero,p_metodo_pago:'Efectivo'})
    await expectRpcFailure('komerizo_marcar_salon_consumo_interno',{p_alquiler_id:state.paidSalonId,p_tesorero_id:treasurer.id})

    await expectRpcSuccess('komerizo_cerrar_actividad_venta',{p_actividad_id:state.salesActivityId,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero})
    await expectRpcFailure('komerizo_registrar_venta_producto',{p_actividad_id:state.salesActivityId,p_comprador_usuario_id:null,p_numero_documento:`CLOSED-${context.runId}`,p_nombre_comprador:'Closed',p_celular:'',p_correo:'',p_cantidad:1,p_estado_inicial:'reservada',p_metodo_pago:null,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero})

    const bonusSummary=await expectRpcSuccess('komerizo_cerrar_bono_solidario',{p_bono_id:state.bonusId,p_puesto_ganador:1,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero,p_metodo_registro_premio:null})
    assert.equal(bonusSummary.resultado_premio,'entregado')
    await expectRpcFailure('komerizo_registrar_compra_bono',{p_bono_id:state.bonusId,p_comprador_usuario_id:null,p_numero_documento:`CLOSED-B-${context.runId}`,p_nombre_comprador:'Closed bonus',p_celular:'',p_correo:'',p_puestos:[2],p_estado_inicial:'reservado',p_metodo_pago:null,p_tesorero_id:treasurer.id,p_tesorero_rol_id:roles.Tesorero})

    assert.equal(await balance(),before)
    return 'All invalid transitions failed without balance mutation'
  })

  await checkedStep(t, 'M — Stress and concurrency', 'M9 — Global duplicate-accounting invariant for this run', 'No current-run source has duplicate registered treasury movements', async () => {
    const movementIds=context.created.treasuryMovements
    if (!movementIds.length) return 'No movements registered'
    const rows=assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id,origen_tipo,origen_id,autorizacion_gasto_id').in('id',movementIds),'Read current-run movements')
    const origins=new Map()
    for(const row of rows){
      if(row.origen_tipo && row.origen_id!==null){const key=`${row.origen_tipo}:${row.origen_id}`; origins.set(key,(origins.get(key)??0)+1)}
    }
    const duplicates=[...origins.entries()].filter(([,count])=>count>1)
    assert.deepEqual(duplicates,[])
    const authCounts=new Map()
    for(const row of rows){if(row.autorizacion_gasto_id){const key=String(row.autorizacion_gasto_id);authCounts.set(key,(authCounts.get(key)??0)+1)}}
    assert.deepEqual([...authCounts.entries()].filter(([,count])=>count>1),[])
    return `${rows.length} run movements checked; no duplicate origins/authorizations`
  })
})
