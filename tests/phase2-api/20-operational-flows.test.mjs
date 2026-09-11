import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { supabase } from './supabase.mjs'
import { context, setupPhase2Fixtures, cleanupPhase2Fixtures } from './fixtures.mjs'
import {
  assertNoSupabaseError,
  expectRpcFailure,
  expectRpcSuccess,
  getCurrentBalance,
  getRow,
  money,
  dateLocalString,
} from './helpers.mjs'
import { record, writeReport } from './reporter.mjs'

const state = {
  expectedBalance: null,
  inventory: {},
  salonConfig: null,
}

function pushUnique(bucket, values) {
  const target = context.created[bucket]
  if (!target) throw new Error(`Unknown created bucket: ${bucket}`)
  for (const value of Array.isArray(values) ? values : [values]) {
    if (value !== null && value !== undefined && !target.includes(value)) target.push(value)
  }
}

async function registerMovement(movementId) {
  if (!movementId) return
  pushUnique('treasuryMovements', Number(movementId))
  const histories = assertNoSupabaseError(
    await supabase.from('komerizo_tesoreria_historial').select('id').eq('movimiento_id', movementId),
    `Register treasury history ${movementId}`,
  )
  pushUnique('treasuryHistory', (histories ?? []).map((row) => row.id))
}

async function registerAuthorization(authId) {
  pushUnique('authorizations', Number(authId))
  const histories = assertNoSupabaseError(
    await supabase.from('komerizo_autorizaciones_gasto_historial').select('id').eq('autorizacion_id', authId),
    `Register authorization histories ${authId}`,
  )
  pushUnique('authorizationHistory', (histories ?? []).map((row) => row.id))
}

async function registerResourceRental(rentalId) {
  pushUnique('resourceRentals', Number(rentalId))
  const items = assertNoSupabaseError(
    await supabase.from('komerizo_alquiler_recursos_items').select('id').eq('alquiler_id', rentalId),
    `Register resource-rental items ${rentalId}`,
  )
  pushUnique('resourceRentalItems', (items ?? []).map((row) => row.id))
  const rental = await getRow('komerizo_alquiler_recursos', rentalId)
  if (rental?.tesoreria_movimiento_id) await registerMovement(rental.tesoreria_movimiento_id)
  if (rental?.deposito_movimiento_id) await registerMovement(rental.deposito_movimiento_id)
  return rental
}

async function registerSalonRental(rentalId) {
  pushUnique('salonRentals', Number(rentalId))
  const items = assertNoSupabaseError(
    await supabase.from('komerizo_alquiler_items').select('id').eq('alquiler_id', rentalId),
    `Register Salon items ${rentalId}`,
  )
  pushUnique('salonRentalItems', (items ?? []).map((row) => row.id))
  const rental = await getRow('komerizo_alquileres', rentalId)
  if (rental?.tesoreria_movimiento_id) await registerMovement(rental.tesoreria_movimiento_id)
  return rental
}

async function registerSale(saleId) {
  pushUnique('sales', Number(saleId))
  const sale = await getRow('komerizo_ventas_actividad', saleId)
  if (sale?.tesoreria_movimiento_id) await registerMovement(sale.tesoreria_movimiento_id)
  return sale
}

async function registerBonusPurchase(purchaseId) {
  pushUnique('bonusPurchases', Number(purchaseId))
  const purchase = await getRow('komerizo_bono_compras', purchaseId)
  if (purchase?.tesoreria_movimiento_id) await registerMovement(purchase.tesoreria_movimiento_id)
  const occupancy = assertNoSupabaseError(
    await supabase.from('komerizo_bono_puestos_ocupados').select('bono_id,numero_puesto').eq('compra_id', purchaseId),
    `Register Bonus occupancy ${purchaseId}`,
  )
  for (const row of occupancy ?? []) pushUnique('bonusOccupancy', row)
  return purchase
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

function addDaysString(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return dateLocalString(d)
}

function timeToMinutes(value) {
  const [h, m] = String(value).split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(value) {
  const h = Math.floor(value / 60)
  const m = value % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

async function assertBalance(expected, label) {
  const row = await getCurrentBalance()
  assert.equal(money(row.saldo_actual), money(expected), `${label}: unexpected balance`)
}

async function createInventory(name, quantity, rentalValue) {
  const row = assertNoSupabaseError(
    await supabase.from('komerizo_inventario').insert({
      nombre: `${context.runId} ${name}`,
      descripcion: `Fixture ${context.runId}`,
      cantidad: quantity,
      unidad: 'unidades',
      valor_unitario: 0,
      categoria: 'Prueba Phase 2',
      estado: 'activo',
      es_alquilable: true,
      valor_alquiler: rentalValue,
    }).select().single(),
    `Create inventory ${name}`,
  )
  pushUnique('inventory', row.id)
  return row
}

async function createTestExpense(amount, concept) {
  const id = Number(await expectRpcSuccess('komerizo_crear_solicitud_egreso_presidencia', {
    p_presidente_id: context.users.president.id,
    p_presidente_rol_id: context.roles.Presidente,
    p_fecha_egreso: dateLocalString(),
    p_monto: amount,
    p_concepto: `${context.runId} ${concept}`,
    p_beneficiario_destino: 'Proveedor fixture',
    p_metodo_pago: 'Transferencia',
    p_justificacion: 'Soporte de fixture de integración',
    p_archivo_adjunto_url: null,
    p_organo_responsable: null,
    p_numero_acta: null,
  }))
  await registerAuthorization(id)
  const movementId = Number(await expectRpcSuccess('komerizo_registrar_egreso_autorizado', {
    p_autorizacion_id: id,
    p_tesorero_id: context.users.treasurer.id,
    p_tesorero_rol_id: context.roles.Tesorero,
  }))
  await registerMovement(movementId)
  await registerAuthorization(id)
  state.expectedBalance = money(state.expectedBalance - amount)
  return { authorizationId: id, movementId }
}

after(async () => {
  try {
    if (context.created.users.length || context._setupComplete) await cleanupPhase2Fixtures()
  } finally {
    writeReport()
  }
})

test('Phase 2 operational JAC API scenarios F-L', async (t) => {
  await setupPhase2Fixtures()
  state.expectedBalance = money(context.baseline.treasuryBalance.saldo_actual)
  state.inventory.chairs = await createInventory('Sillas', 20, 5000)
  state.inventory.tables = await createInventory('Mesas', 8, 15000)
  state.inventory.sound = await createInventory('Equipo sonido', 1, 80000)

  state.salonConfig = assertNoSupabaseError(
    await supabase.from('komerizo_salon_config').select('*').eq('estado', 'activo').order('id', { ascending: false }).limit(1).maybeSingle(),
    'Read active Salon configuration',
  )
  assert.ok(state.salonConfig, 'No existe configuración activa del salón para ejecutar F-L')

  const treasurer = context.users.treasurer
  const affiliate = context.users.affiliate1
  const roles = context.roles

  // F — Physical resource rentals
  await checkedStep(t, 'F — Physical resource rentals', 'F1 — Affiliate rental uses DB inventory prices', '5 chairs + 2 tables = 55,000 and starts pending payment', async () => {
    const id = Number(await expectRpcSuccess('komerizo_crear_alquiler_recursos', {
      p_creado_por: treasurer.id,
      p_rol_creador_id: roles.Tesorero,
      p_tipo_arrendatario: 'afiliado',
      p_usuario_arrendatario_id: affiliate.id,
      p_numero_documento: affiliate.cc,
      p_nombres: affiliate.nombre,
      p_apellidos: affiliate.apellido,
      p_direccion: affiliate.direccion,
      p_celular: affiliate.telefono,
      p_correo: affiliate.correo_electronico,
      p_fecha_inicio: addDaysString(30),
      p_fecha_fin: addDaysString(31),
      p_deposito_garantia: 100000,
      p_clausulas_uso: `${context.runId} cláusulas de uso`,
      p_exonerado_pago: false,
      p_justificacion_exoneracion: null,
      p_items: [
        { inventario_id: state.inventory.chairs.id, cantidad: 5 },
        { inventario_id: state.inventory.tables.id, cantidad: 2 },
      ],
    }))
    state.rentalPaid = id
    const rental = await registerResourceRental(id)
    assert.equal(money(rental.valor_alquiler), 55000)
    assert.equal(rental.estado_pago, 'pendiente')
    assert.equal(rental.estado_alquiler, 'pendiente')
    return `Rental ${id} total ${rental.valor_alquiler}`
  })

  await checkedStep(t, 'F — Physical resource rentals', 'F2 — Rental payment posts exactly one income', 'Rental becomes active/completed-payment and balance +55,000', async () => {
    const movementId = Number(await expectRpcSuccess('komerizo_confirmar_pago_alquiler_recursos', {
      p_alquiler_id: state.rentalPaid,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
      p_metodo_pago: 'Efectivo',
    }))
    await registerMovement(movementId)
    const rental = await registerResourceRental(state.rentalPaid)
    assert.equal(rental.estado_pago, 'completado')
    assert.equal(rental.estado_alquiler, 'activo')
    assert.equal(Number(rental.tesoreria_movimiento_id), movementId)
    state.expectedBalance = money(state.expectedBalance + 55000)
    await assertBalance(state.expectedBalance, 'F2')
    await expectRpcFailure('komerizo_confirmar_pago_alquiler_recursos', {
      p_alquiler_id: state.rentalPaid,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
      p_metodo_pago: 'Efectivo',
    })
    const movements = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('origen_tipo', 'alquiler_recursos').eq('origen_id', state.rentalPaid), 'Count rental payment movements')
    assert.equal(movements.length, 1)
    return `Movement ${movementId}; duplicate payment blocked`
  })

  await checkedStep(t, 'F — Physical resource rentals', 'F3 — Closing without damage returns deposit without income', 'Deposit becomes devuelto and balance does not change', async () => {
    await expectRpcSuccess('komerizo_cerrar_alquiler_recursos', {
      p_alquiler_id: state.rentalPaid,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
      p_hubo_danos: false,
      p_observacion: `${context.runId} devolución sin daños`,
    })
    const rental = await registerResourceRental(state.rentalPaid)
    assert.equal(rental.estado_alquiler, 'completado')
    assert.equal(rental.estado_deposito, 'devuelto')
    assert.equal(rental.deposito_movimiento_id, null)
    await assertBalance(state.expectedBalance, 'F3')
    return 'Deposit returned without accounting income'
  })

  await checkedStep(t, 'F — Physical resource rentals', 'F4 — Damage applies guarantee deposit as one income', '120,000 deposit is posted once when rental closes with damage', async () => {
    const id = Number(await expectRpcSuccess('komerizo_crear_alquiler_recursos', {
      p_creado_por: treasurer.id,
      p_rol_creador_id: roles.Tesorero,
      p_tipo_arrendatario: 'externo',
      p_usuario_arrendatario_id: null,
      p_numero_documento: `EXT-${context.runId}`,
      p_nombres: 'Carlos',
      p_apellidos: 'Externo',
      p_direccion: 'Dirección fixture',
      p_celular: '3000000001',
      p_correo: `carlos-${context.runId}@example.invalid`,
      p_fecha_inicio: addDaysString(40),
      p_fecha_fin: addDaysString(40),
      p_deposito_garantia: 120000,
      p_clausulas_uso: `${context.runId} cláusulas`,
      p_exonerado_pago: false,
      p_justificacion_exoneracion: null,
      p_items: [{ inventario_id: state.inventory.sound.id, cantidad: 1 }],
    }))
    await registerResourceRental(id)
    const paymentId = Number(await expectRpcSuccess('komerizo_confirmar_pago_alquiler_recursos', {
      p_alquiler_id: id,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
      p_metodo_pago: 'Transferencia',
    }))
    await registerMovement(paymentId)
    state.expectedBalance = money(state.expectedBalance + 80000)
    await expectRpcSuccess('komerizo_cerrar_alquiler_recursos', {
      p_alquiler_id: id,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
      p_hubo_danos: true,
      p_observacion: `${context.runId} daño fixture`,
    })
    const rental = await registerResourceRental(id)
    assert.equal(rental.estado_deposito, 'aplicado_danos')
    assert.ok(rental.deposito_movimiento_id)
    state.expectedBalance = money(state.expectedBalance + 120000)
    await assertBalance(state.expectedBalance, 'F4')
    const depositRows = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id,cantidad').eq('origen_tipo', 'alquiler_recursos_deposito').eq('origen_id', id), 'Count damage-deposit movements')
    assert.equal(depositRows.length, 1)
    assert.equal(money(depositRows[0].cantidad), 120000)
    return `Rental ${id} applied one damage deposit movement`
  })

  await checkedStep(t, 'F — Physical resource rentals', 'F5 — Exemption rules enforce external/affiliate/comunal policy', 'External exemption fails; valid affiliate and communal exemptions create no income', async () => {
    const date = addDaysString(50)
    const base = {
      p_creado_por: treasurer.id,
      p_rol_creador_id: roles.Tesorero,
      p_fecha_inicio: date,
      p_fecha_fin: date,
      p_deposito_garantia: 0,
      p_clausulas_uso: `${context.runId} cláusulas exoneración`,
      p_exonerado_pago: true,
      p_justificacion_exoneracion: `${context.runId} exoneración autorizada`,
      p_items: [{ inventario_id: state.inventory.chairs.id, cantidad: 1 }],
    }
    const externalResult = await supabase.rpc('komerizo_crear_alquiler_recursos', {
      ...base,
      p_tipo_arrendatario: 'externo',
      p_usuario_arrendatario_id: null,
      p_numero_documento: `EXT-X-${context.runId}`,
      p_nombres: 'Externo', p_apellidos: 'Bloqueado', p_direccion: '-', p_celular: '-', p_correo: '',
    })
    if (!externalResult.error) {
      const unexpectedRentalId = Number(externalResult.data)
      if (Number.isFinite(unexpectedRentalId) && unexpectedRentalId > 0) {
        await registerResourceRental(unexpectedRentalId)
      }
      assert.fail('RPC komerizo_crear_alquiler_recursos was expected to reject external exemption but created a rental')
    }
    assert.match(String(externalResult.error.message ?? '').toLowerCase(), /externos no pueden ser exonerados/)

    const affId = Number(await expectRpcSuccess('komerizo_crear_alquiler_recursos', {
      ...base,
      p_tipo_arrendatario: 'afiliado',
      p_usuario_arrendatario_id: affiliate.id,
      p_numero_documento: affiliate.cc,
      p_nombres: affiliate.nombre, p_apellidos: affiliate.apellido, p_direccion: affiliate.direccion, p_celular: affiliate.telefono, p_correo: affiliate.correo_electronico,
    }))
    const aff = await registerResourceRental(affId)
    assert.equal(aff.estado_pago, 'exonerado')
    assert.equal(aff.estado_alquiler, 'activo')
    assert.equal(aff.tesoreria_movimiento_id, null)

    const communalId = Number(await expectRpcSuccess('komerizo_crear_alquiler_recursos', {
      ...base,
      p_tipo_arrendatario: 'comunal',
      p_usuario_arrendatario_id: null,
      p_numero_documento: `COM-${context.runId}`,
      p_nombres: 'Comunidad', p_apellidos: 'Barrio', p_direccion: 'Sede comunal', p_celular: '-', p_correo: '',
    }))
    const communal = await registerResourceRental(communalId)
    assert.equal(communal.estado_pago, 'exonerado')
    assert.equal(communal.tesoreria_movimiento_id, null)
    await assertBalance(state.expectedBalance, 'F5')
    return 'Exemption rules enforced with no accounting leakage'
  })

  // G — Shared inventory between standalone rentals and Salon
  await checkedStep(t, 'G — Shared inventory', 'G1 — Salon reservation reduces standalone resource availability', '15 Salon chairs leaves only 5 available for overlapping standalone rental', async () => {
    const date = addDaysString(100)
    const open = timeToMinutes(state.salonConfig.hora_apertura)
    const salonId = Number(await expectRpcSuccess('komerizo_crear_reserva_salon', {
      p_usuario_id: affiliate.id,
      p_rol_id: roles.Usuario,
      p_tipo_alquiler: 'por_hora',
      p_fecha_inicio: date,
      p_fecha_fin: date,
      p_hora_inicio: minutesToTime(open),
      p_hora_fin: minutesToTime(open + 60),
      p_motivo: `${context.runId} Salon + 15 sillas`,
      p_items: [{ inventario_id: state.inventory.chairs.id, cantidad: 15 }],
    }))
    await registerSalonRental(salonId)
    const rentalBase = {
      p_creado_por: treasurer.id, p_rol_creador_id: roles.Tesorero,
      p_tipo_arrendatario: 'externo', p_usuario_arrendatario_id: null,
      p_numero_documento: `SHARED-${context.runId}`, p_nombres: 'Shared', p_apellidos: 'Inventory',
      p_direccion: '-', p_celular: '-', p_correo: '', p_fecha_inicio: date, p_fecha_fin: date,
      p_deposito_garantia: 0, p_clausulas_uso: 'Fixture shared inventory', p_exonerado_pago: false, p_justificacion_exoneracion: null,
    }
    await expectRpcFailure('komerizo_crear_alquiler_recursos', { ...rentalBase, p_items: [{ inventario_id: state.inventory.chairs.id, cantidad: 6 }] })
    const okId = Number(await expectRpcSuccess('komerizo_crear_alquiler_recursos', { ...rentalBase, p_items: [{ inventario_id: state.inventory.chairs.id, cantidad: 5 }] }))
    await registerResourceRental(okId)
    return 'Shared availability prevented 21/20 chairs and allowed exactly 20/20'
  })

  await checkedStep(t, 'G — Shared inventory', 'G2 — Standalone rental reduces Salon resource availability', 'Standalone 6/8 tables causes Salon request for 3 to fail and 2 to succeed', async () => {
    const date = addDaysString(110)
    const standaloneId = Number(await expectRpcSuccess('komerizo_crear_alquiler_recursos', {
      p_creado_por: treasurer.id, p_rol_creador_id: roles.Tesorero,
      p_tipo_arrendatario: 'externo', p_usuario_arrendatario_id: null,
      p_numero_documento: `REV-${context.runId}`, p_nombres: 'Reverse', p_apellidos: 'Availability',
      p_direccion: '-', p_celular: '-', p_correo: '', p_fecha_inicio: date, p_fecha_fin: date,
      p_deposito_garantia: 0, p_clausulas_uso: 'Fixture reverse inventory', p_exonerado_pago: false, p_justificacion_exoneracion: null,
      p_items: [{ inventario_id: state.inventory.tables.id, cantidad: 6 }],
    }))
    await registerResourceRental(standaloneId)
    const open = timeToMinutes(state.salonConfig.hora_apertura)
    const base = {
      p_usuario_id: affiliate.id, p_rol_id: roles.Usuario, p_tipo_alquiler: 'por_hora',
      p_fecha_inicio: date, p_fecha_fin: date, p_hora_inicio: minutesToTime(open), p_hora_fin: minutesToTime(open + 60),
      p_motivo: `${context.runId} reverse shared inventory`,
    }
    await expectRpcFailure('komerizo_crear_reserva_salon', { ...base, p_items: [{ inventario_id: state.inventory.tables.id, cantidad: 3 }] })
    const salonId = Number(await expectRpcSuccess('komerizo_crear_reserva_salon', { ...base, p_items: [{ inventario_id: state.inventory.tables.id, cantidad: 2 }] }))
    await registerSalonRental(salonId)
    return 'Reverse shared-availability rule passed'
  })

  // H — Salon overlap and payments
  await checkedStep(t, 'H — Community hall', 'H1 — Adjacent hourly reservations are allowed and overlap/day collision is blocked', '08-10 and 10-12 equivalent slots coexist; overlap and all-day conflict fail', async () => {
    const date = addDaysString(130)
    const open = timeToMinutes(state.salonConfig.hora_apertura)
    const close = timeToMinutes(state.salonConfig.hora_cierre)
    assert.ok(close - open >= 180, 'Salon active configuration must expose at least three hours for overlap tests')
    const base = { p_usuario_id: affiliate.id, p_rol_id: roles.Usuario, p_tipo_alquiler: 'por_hora', p_fecha_inicio: date, p_fecha_fin: date, p_items: [] }
    const a = Number(await expectRpcSuccess('komerizo_crear_reserva_salon', { ...base, p_hora_inicio: minutesToTime(open), p_hora_fin: minutesToTime(open + 60), p_motivo: `${context.runId} H-A` }))
    const b = Number(await expectRpcSuccess('komerizo_crear_reserva_salon', { ...base, p_hora_inicio: minutesToTime(open + 60), p_hora_fin: minutesToTime(open + 120), p_motivo: `${context.runId} H-B` }))
    await registerSalonRental(a); await registerSalonRental(b)
    state.salonPaid = a
    await expectRpcFailure('komerizo_crear_reserva_salon', { ...base, p_hora_inicio: minutesToTime(open + 30), p_hora_fin: minutesToTime(open + 90), p_motivo: `${context.runId} H-overlap` })
    await expectRpcFailure('komerizo_crear_reserva_salon', { p_usuario_id: affiliate.id, p_rol_id: roles.Usuario, p_tipo_alquiler: 'por_dia', p_fecha_inicio: date, p_fecha_fin: date, p_hora_inicio: null, p_hora_fin: null, p_motivo: `${context.runId} H-day-conflict`, p_items: [] })
    return `Adjacent reservations ${a}/${b} succeeded; conflicts rejected`
  })

  await checkedStep(t, 'H — Community hall', 'H2 — Salon payment is idempotent and internal consumption creates no income', 'Paid reservation creates one movement; duplicate fails; internal reservation stays zero-income', async () => {
    const paidRowBefore = await getRow('komerizo_alquileres', state.salonPaid)
    const movementId = Number(await expectRpcSuccess('komerizo_confirmar_pago_salon', {
      p_alquiler_id: state.salonPaid, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_pago: 'Efectivo',
    }))
    await registerMovement(movementId)
    await registerSalonRental(state.salonPaid)
    state.expectedBalance = money(state.expectedBalance + money(paidRowBefore.valor_total))
    await assertBalance(state.expectedBalance, 'H2-paid')
    await expectRpcFailure('komerizo_confirmar_pago_salon', {
      p_alquiler_id: state.salonPaid, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_pago: 'Efectivo',
    })
    const paidMoves = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('origen_tipo', 'salon').eq('origen_id', state.salonPaid), 'Count Salon movements')
    assert.equal(paidMoves.length, 1)

    const date = addDaysString(131)
    const open = timeToMinutes(state.salonConfig.hora_apertura)
    const internalId = Number(await expectRpcSuccess('komerizo_crear_reserva_salon', {
      p_usuario_id: affiliate.id, p_rol_id: roles.Usuario, p_tipo_alquiler: 'por_hora', p_fecha_inicio: date, p_fecha_fin: date,
      p_hora_inicio: minutesToTime(open), p_hora_fin: minutesToTime(open + 60), p_motivo: `${context.runId} consumo interno`, p_items: [],
    }))
    await registerSalonRental(internalId)
    await expectRpcSuccess('komerizo_marcar_salon_consumo_interno', { p_alquiler_id: internalId, p_tesorero_id: treasurer.id })
    const internal = await registerSalonRental(internalId)
    assert.equal(internal.estado_pago, 'exonerado')
    assert.equal(money(internal.valor_total), 0)
    assert.equal(internal.tesoreria_movimiento_id, null)
    await assertBalance(state.expectedBalance, 'H2-internal')
    return `Salon movement ${movementId}; internal reservation created no movement`
  })

  // I — Donations / contributions
  await checkedStep(t, 'I — Donations and contributions', 'I1 — Donation and affiliate contribution post one income each; invalid amounts roll back', '300k donation + 50k quota increase balance by 350k; invalid inputs persist nothing', async () => {
    const donationId = Number(await expectRpcSuccess('komerizo_registrar_donacion_cuota', {
      p_tipo: 'donacion', p_usuario_asociado_id: null, p_numero_documento: `DON-${context.runId}`,
      p_nombre_persona: `${context.runId} Donante`, p_celular: '3000000002', p_correo: '', p_monto: 300000,
      p_justificacion: 'Apoyo actividad comunitaria', p_metodo_pago: 'Efectivo', p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    pushUnique('donations', donationId)
    const donation = await getRow('komerizo_ingresos_donaciones_cuotas', donationId)
    await registerMovement(donation.tesoreria_movimiento_id)

    const quotaId = Number(await expectRpcSuccess('komerizo_registrar_donacion_cuota', {
      p_tipo: 'cuota', p_usuario_asociado_id: affiliate.id, p_numero_documento: affiliate.cc,
      p_nombre_persona: `${affiliate.nombre} ${affiliate.apellido}`, p_celular: affiliate.telefono, p_correo: affiliate.correo_electronico, p_monto: 50000,
      p_justificacion: 'Cuota fixture', p_metodo_pago: 'Transferencia', p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    pushUnique('donations', quotaId)
    const quota = await getRow('komerizo_ingresos_donaciones_cuotas', quotaId)
    await registerMovement(quota.tesoreria_movimiento_id)
    state.expectedBalance = money(state.expectedBalance + 350000)
    await assertBalance(state.expectedBalance, 'I1')

    const before = assertNoSupabaseError(await supabase.from('komerizo_ingresos_donaciones_cuotas').select('id').eq('nombre_persona', `${context.runId} Invalid donation`), 'Read invalid donation before')
    assert.equal(before.length, 0)
    await expectRpcFailure('komerizo_registrar_donacion_cuota', {
      p_tipo: 'donacion', p_usuario_asociado_id: null, p_numero_documento: `INV-${context.runId}`,
      p_nombre_persona: `${context.runId} Invalid donation`, p_celular: '', p_correo: '', p_monto: 0,
      p_justificacion: 'invalid', p_metodo_pago: 'Efectivo', p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    })
    const afterRows = assertNoSupabaseError(await supabase.from('komerizo_ingresos_donaciones_cuotas').select('id').eq('nombre_persona', `${context.runId} Invalid donation`), 'Read invalid donation after')
    assert.equal(afterRows.length, 0)
    return `Donation ${donationId}, quota ${quotaId}; invalid amount rolled back`
  })

  // J — Product sales
  await checkedStep(t, 'J — Product sales', 'J1 — Product activity supports paid/reserved/pending/cancelled flows and late collection', 'Sales preserve stock, accounting, close snapshot and post-close debt collection', async () => {
    const expense = await createTestExpense(100000, 'Compra ingredientes venta')
    const activityId = Number(await expectRpcSuccess('komerizo_crear_actividad_venta', {
      p_nombre: `${context.runId} Día de la Familia`, p_producto_nombre: 'Tamal de prueba', p_descripcion: 'Actividad fixture',
      p_cantidad_inicial: 100, p_precio_unitario: 12000, p_fecha_entrega: addDaysString(160), p_egresos: [expense.movementId],
      p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    pushUnique('salesActivities', activityId)
    pushUnique('activityExpenseLinks', { actividad_id: activityId, movimiento_tesoreria_id: expense.movementId })

    const paidId = Number(await expectRpcSuccess('komerizo_registrar_venta_producto', {
      p_actividad_id: activityId, p_comprador_usuario_id: affiliate.id, p_numero_documento: affiliate.cc,
      p_nombre_comprador: `${affiliate.nombre} ${affiliate.apellido}`, p_celular: affiliate.telefono, p_correo: affiliate.correo_electronico,
      p_cantidad: 10, p_estado_inicial: 'pagada', p_metodo_pago: 'Efectivo', p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    const paid = await registerSale(paidId)
    state.expectedBalance = money(state.expectedBalance + money(paid.total))

    const reserveId = Number(await expectRpcSuccess('komerizo_registrar_venta_producto', {
      p_actividad_id: activityId, p_comprador_usuario_id: context.users.affiliate2.id, p_numero_documento: context.users.affiliate2.cc,
      p_nombre_comprador: 'María Afiliada', p_celular: '', p_correo: '', p_cantidad: 15, p_estado_inicial: 'reservada', p_metodo_pago: null,
      p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    await registerSale(reserveId)
    const reserveMove = Number(await expectRpcSuccess('komerizo_pagar_reserva_producto', {
      p_venta_id: reserveId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_pago: 'Transferencia',
    }))
    await registerMovement(reserveMove); const reservePaid = await registerSale(reserveId)
    state.expectedBalance = money(state.expectedBalance + money(reservePaid.total))

    const pendingId = Number(await expectRpcSuccess('komerizo_registrar_venta_producto', {
      p_actividad_id: activityId, p_comprador_usuario_id: null, p_numero_documento: `PEND-${context.runId}`, p_nombre_comprador: 'Comprador Pendiente',
      p_celular: '', p_correo: '', p_cantidad: 20, p_estado_inicial: 'reservada', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    await registerSale(pendingId)
    await expectRpcSuccess('komerizo_marcar_producto_pendiente_pago', { p_venta_id: pendingId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero })
    const pending = await registerSale(pendingId); assert.equal(pending.estado, 'pendiente_pago'); assert.equal(pending.tesoreria_movimiento_id, null)

    const cancelId = Number(await expectRpcSuccess('komerizo_registrar_venta_producto', {
      p_actividad_id: activityId, p_comprador_usuario_id: null, p_numero_documento: `CAN-${context.runId}`, p_nombre_comprador: 'Comprador Cancela',
      p_celular: '', p_correo: '', p_cantidad: 5, p_estado_inicial: 'reservada', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    await registerSale(cancelId)
    await expectRpcSuccess('komerizo_cancelar_reserva_producto', { p_venta_id: cancelId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero })
    assert.equal((await registerSale(cancelId)).estado, 'cancelada')

    const lossId = Number(await expectRpcSuccess('komerizo_registrar_venta_producto', {
      p_actividad_id: activityId, p_comprador_usuario_id: null, p_numero_documento: `LOSS-${context.runId}`, p_nombre_comprador: 'Reserva no reportada',
      p_celular: '', p_correo: '', p_cantidad: 7, p_estado_inicial: 'reservada', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    await registerSale(lossId)

    await expectRpcFailure('komerizo_registrar_venta_producto', {
      p_actividad_id: activityId, p_comprador_usuario_id: null, p_numero_documento: `OVER-${context.runId}`, p_nombre_comprador: 'Oversell',
      p_celular: '', p_correo: '', p_cantidad: 1000, p_estado_inicial: 'reservada', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    })

    const summary = await expectRpcSuccess('komerizo_cerrar_actividad_venta', { p_actividad_id: activityId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero })
    assert.equal(Number(summary.unidades_pagadas), 25)
    assert.equal(Number(summary.unidades_pendientes_pago), 20)
    assert.equal(Number(summary.unidades_reservadas_no_reportadas), 7)
    const activityBeforeLate = await getRow('komerizo_actividades_venta', activityId)
    const snapshotBefore = JSON.stringify(activityBeforeLate.resumen_cierre)

    const lateMove = Number(await expectRpcSuccess('komerizo_cobrar_venta_pendiente', {
      p_venta_id: pendingId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_pago: 'Efectivo',
    }))
    await registerMovement(lateMove); const paidLate = await registerSale(pendingId)
    state.expectedBalance = money(state.expectedBalance + money(paidLate.total))
    const activityAfterLate = await getRow('komerizo_actividades_venta', activityId)
    assert.equal(JSON.stringify(activityAfterLate.resumen_cierre), snapshotBefore)
    await assertBalance(state.expectedBalance, 'J1')
    return `Activity ${activityId} closed; late debt collection preserved snapshot`
  })

  // K — Bono Solidario
  await checkedStep(t, 'K — Bono Solidario', 'K1 — Paid/reserved/cancelled positions and winner rules are enforced', 'Paid positions post income, cancellations release positions, unpaid/available winner produces prize income once', async () => {
    const bonusId = Number(await expectRpcSuccess('komerizo_crear_bono_solidario', {
      p_nombre: `${context.runId} Bono pagado`, p_descripcion: 'Fixture', p_cantidad_puestos: 100, p_valor_puesto: 20000, p_valor_premio: 500000,
      p_fecha_actividad: addDaysString(180), p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    pushUnique('bonuses', bonusId)
    const paidPurchaseId = Number(await expectRpcSuccess('komerizo_registrar_compra_bono', {
      p_bono_id: bonusId, p_comprador_usuario_id: affiliate.id, p_numero_documento: affiliate.cc, p_nombre_comprador: 'Juan Afiliado',
      p_celular: '', p_correo: '', p_puestos: [1,2,3], p_estado_inicial: 'pagado', p_metodo_pago: 'Efectivo', p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    const paidPurchase = await registerBonusPurchase(paidPurchaseId)
    state.expectedBalance = money(state.expectedBalance + money(paidPurchase.total))

    const reserveId = Number(await expectRpcSuccess('komerizo_registrar_compra_bono', {
      p_bono_id: bonusId, p_comprador_usuario_id: context.users.affiliate2.id, p_numero_documento: context.users.affiliate2.cc, p_nombre_comprador: 'María Afiliada',
      p_celular: '', p_correo: '', p_puestos: [4,5], p_estado_inicial: 'reservado', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    await registerBonusPurchase(reserveId)
    const reserveMove = Number(await expectRpcSuccess('komerizo_pagar_reserva_bono', { p_compra_id: reserveId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_pago: 'Transferencia' }))
    await registerMovement(reserveMove); const reservePaid = await registerBonusPurchase(reserveId)
    state.expectedBalance = money(state.expectedBalance + money(reservePaid.total))

    const cancelId = Number(await expectRpcSuccess('komerizo_registrar_compra_bono', {
      p_bono_id: bonusId, p_comprador_usuario_id: null, p_numero_documento: `BON-C-${context.runId}`, p_nombre_comprador: 'Cancelador',
      p_celular: '', p_correo: '', p_puestos: [6,7], p_estado_inicial: 'reservado', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    await registerBonusPurchase(cancelId)
    await expectRpcSuccess('komerizo_cancelar_reserva_bono', { p_compra_id: cancelId, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero })
    assert.equal((await getRow('komerizo_bono_compras', cancelId)).estado, 'cancelado')
    const freed = assertNoSupabaseError(await supabase.from('komerizo_bono_puestos_ocupados').select('numero_puesto').eq('compra_id', cancelId), 'Verify Bonus release')
    assert.equal(freed.length, 0)
    await expectRpcFailure('komerizo_registrar_compra_bono', {
      p_bono_id: bonusId, p_comprador_usuario_id: null, p_numero_documento: `DUP-${context.runId}`, p_nombre_comprador: 'Duplicado', p_celular: '', p_correo: '',
      p_puestos: [1], p_estado_inicial: 'reservado', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    })
    const paidWinnerSummary = await expectRpcSuccess('komerizo_cerrar_bono_solidario', { p_bono_id: bonusId, p_puesto_ganador: 1, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_registro_premio: null })
    assert.equal(paidWinnerSummary.resultado_premio, 'entregado')

    const unpaidBonusId = Number(await expectRpcSuccess('komerizo_crear_bono_solidario', {
      p_nombre: `${context.runId} Bono reservado ganador`, p_descripcion: 'Fixture', p_cantidad_puestos: 10, p_valor_puesto: 20000, p_valor_premio: 500000,
      p_fecha_actividad: addDaysString(181), p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    pushUnique('bonuses', unpaidBonusId)
    const unpaidPurchaseId = Number(await expectRpcSuccess('komerizo_registrar_compra_bono', {
      p_bono_id: unpaidBonusId, p_comprador_usuario_id: null, p_numero_documento: `UNP-${context.runId}`, p_nombre_comprador: 'Reservado sin pagar',
      p_celular: '', p_correo: '', p_puestos: [1], p_estado_inicial: 'reservado', p_metodo_pago: null, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    await registerBonusPurchase(unpaidPurchaseId)
    const unpaidSummary = await expectRpcSuccess('komerizo_cerrar_bono_solidario', { p_bono_id: unpaidBonusId, p_puesto_ganador: 1, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_registro_premio: 'Efectivo' })
    assert.equal(unpaidSummary.resultado_premio, 'no_entregado')
    const unpaidBonus = await getRow('komerizo_bonos_solidarios', unpaidBonusId)
    assert.ok(unpaidBonus.movimiento_premio_no_entregado_id)
    await registerMovement(unpaidBonus.movimiento_premio_no_entregado_id)
    state.expectedBalance = money(state.expectedBalance + 500000)

    const availableBonusId = Number(await expectRpcSuccess('komerizo_crear_bono_solidario', {
      p_nombre: `${context.runId} Bono ganador disponible`, p_descripcion: 'Fixture', p_cantidad_puestos: 10, p_valor_puesto: 20000, p_valor_premio: 500000,
      p_fecha_actividad: addDaysString(182), p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero,
    }))
    pushUnique('bonuses', availableBonusId)
    const availableSummary = await expectRpcSuccess('komerizo_cerrar_bono_solidario', { p_bono_id: availableBonusId, p_puesto_ganador: 1, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero, p_metodo_registro_premio: 'Transferencia' })
    assert.equal(availableSummary.resultado_premio, 'no_entregado')
    const availableBonus = await getRow('komerizo_bonos_solidarios', availableBonusId)
    await registerMovement(availableBonus.movimiento_premio_no_entregado_id)
    state.expectedBalance = money(state.expectedBalance + 500000)
    await assertBalance(state.expectedBalance, 'K1')
    return 'Bonus flows and winner accounting rules passed'
  })

  // L — Reports and statistics
  await checkedStep(t, 'L — Reports and statistics', 'L1 — Financial/Fiscal reports and affiliate statistics are internally consistent', 'Reports generate and 3/6/12-month statistics return finite data', async () => {
    const today = dateLocalString()
    const financialId = Number(await expectRpcSuccess('komerizo_generar_reporte_financiero', { p_tipo: 'bimestral', p_fecha_fin: today, p_tesorero_id: treasurer.id, p_tesorero_rol_id: roles.Tesorero }))
    pushUnique('reports', financialId)
    const financial = await getRow('komerizo_reportes_financieros', financialId)
    const r = financial.resumen
    assert.equal(money(r.saldo_inicial) + money(r.total_ingresos) - money(r.total_egresos), money(r.saldo_final))
    assert.equal(money(r.resultado_periodo), money(r.total_ingresos) - money(r.total_egresos))

    const fiscalId = Number(await expectRpcSuccess('komerizo_generar_reporte_fiscal', { p_tipo: 'bimestral', p_fecha_fin: today, p_fiscal_id: context.users.fiscal.id, p_fiscal_rol_id: roles.Fiscal }))
    pushUnique('fiscalReports', fiscalId)
    const fiscal = await getRow('komerizo_reportes_fiscales', fiscalId)
    assert.ok(fiscal.resumen)
    assert.ok(Array.isArray(fiscal.alertas))

    for (const months of [3,6,12]) {
      const stats = await expectRpcSuccess('komerizo_estadisticas_financieras', { p_meses: months })
      for (const key of ['saldo_actual','total_ingresos_periodo','total_egresos_periodo','resultado_periodo']) {
        assert.ok(Number.isFinite(Number(stats[key])), `${months}m ${key} must be finite`)
      }
      assert.ok(Array.isArray(stats.mensual))
      assert.ok(Array.isArray(stats.origenes_ingreso))
      assert.ok(Array.isArray(stats.principales_egresos))
    }
    await assertBalance(state.expectedBalance, 'L1')
    return `Reports ${financialId}/${fiscalId} and 3/6/12-month stats passed`
  })
})
