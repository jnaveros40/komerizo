import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { supabase } from './supabase.mjs'
import { context, setupPhase2Fixtures, cleanupPhase2Fixtures } from './fixtures.mjs'
import {
  assertNoSupabaseError,
  expectRpcFailure,
  expectRpcSuccess,
  getCurrentBalance,
  getLatestConfiguration,
  getRow,
  money,
  dateLocalString,
} from './helpers.mjs'
import { record, writeReport } from './reporter.mjs'

const state = {
  expectedBalance: null,
  normalAuthorizationId: null,
  normalMovementId: null,
  highAuthorizationId: null,
  alertAuthorizationId: null,
  reportRequestId: null,
  testFundingAmount: 5000000,
  testFundingMovementId: null,
  adminDirectConfigApplied: false,
  highReturned: false,
  highCorrected: false,
  highMovementId: null,
  treasurerAlertId: null,
}

function pushUnique(bucket, values) {
  const target = context.created[bucket]
  if (!target) throw new Error(`Unknown created bucket: ${bucket}`)
  for (const value of Array.isArray(values) ? values : [values]) {
    if (value !== null && value !== undefined && !target.includes(value)) target.push(value)
  }
}

async function registerAuthorizationDependencies(authorizationId) {
  const histories = assertNoSupabaseError(
    await supabase.from('komerizo_autorizaciones_gasto_historial').select('id').eq('autorizacion_id', authorizationId),
    `Register authorization history ${authorizationId}`,
  )
  pushUnique('authorizationHistory', (histories ?? []).map((row) => row.id))

  const alerts = assertNoSupabaseError(
    await supabase.from('komerizo_alertas_fiscales').select('id').eq('autorizacion_gasto_id', authorizationId),
    `Register fiscal alerts for authorization ${authorizationId}`,
  )
  pushUnique('fiscalAlerts', (alerts ?? []).map((row) => row.id))
}

async function registerMovementDependencies(movementId) {
  pushUnique('treasuryMovements', movementId)
  const histories = assertNoSupabaseError(
    await supabase.from('komerizo_tesoreria_historial').select('id').eq('movimiento_id', movementId),
    `Register treasury history ${movementId}`,
  )
  pushUnique('treasuryHistory', (histories ?? []).map((row) => row.id))

  const alerts = assertNoSupabaseError(
    await supabase.from('komerizo_alertas_fiscales').select('id').eq('movimiento_tesoreria_id', movementId),
    `Register movement fiscal alerts ${movementId}`,
  )
  pushUnique('fiscalAlerts', (alerts ?? []).map((row) => row.id))
}

async function checkedStep(t, scenario, step, expected, action) {
  const started = Date.now()
  await t.test(step, async (childT) => {
    try {
      const actual = await action()
      record({
        scenario,
        step,
        status: 'passed',
        expected,
        actual: typeof actual === 'string' ? actual : 'Condition satisfied',
        duration: Date.now() - started,
      })
    } catch (error) {
      if (error?.code === 'PHASE2_PREREQUISITE') {
        record({
          scenario,
          step,
          status: 'skipped',
          expected,
          actual: 'Prerequisite unavailable',
          error,
          duration: Date.now() - started,
        })
        childT.skip(error.message)
        return
      }
      record({
        scenario,
        step,
        status: 'failed',
        expected,
        actual: 'Condition failed',
        error,
        duration: Date.now() - started,
      })
      throw error
    }
  })
}

function requirePrerequisite(condition, reason) {
  if (condition) return
  const error = new Error(reason)
  error.code = 'PHASE2_PREREQUISITE'
  throw error
}

async function skippedStep(t, scenario, step, expected, reason) {
  record({
    scenario,
    step,
    status: 'skipped',
    expected,
    actual: 'Prerequisite unavailable',
    error: reason,
    duration: 0,
  })
  await t.test(step, { skip: reason }, () => {})
}

async function readAuthorization(id) {
  return getRow('komerizo_autorizaciones_gasto', id)
}

async function readMovement(id) {
  return getRow('komerizo_tesoreria', id)
}

async function assertBalance(expected, label) {
  const balance = await getCurrentBalance()
  assert.ok(balance, `${label}: treasury balance row is missing`)
  assert.equal(money(balance.saldo_actual), money(expected), `${label}: unexpected treasury balance`)
  return balance
}

after(async () => {
  try {
    if (context.created.users.length || context._setupComplete) await cleanupPhase2Fixtures()
  } finally {
    writeReport()
  }
})

test('Phase 2 core JAC financial API scenarios A-E', async (t) => {
  await setupPhase2Fixtures()
  state.expectedBalance = money(context.baseline.treasuryBalance.saldo_actual)

  const admin = context.users.administrator
  const secretary = context.users.secretary
  const president = context.users.president
  const treasurer = context.users.treasurer
  const fiscal = context.users.fiscal
  const affiliate = context.users.affiliate1
  const roles = context.roles
  const today = dateLocalString()

  await checkedStep(t, 'A — Statutes and thresholds', 'A1 — Administrator sets thresholds directly', 'Configuration becomes 1.2M / 3.5M and persists reason', async () => {
    await expectRpcSuccess('komerizo_fijar_cuantias_administrador', {
      p_administrador_id: admin.id,
      p_tope_gasto_presidente: 1200000,
      p_tope_gasto_junta: 3500000,
      p_motivo: `${context.runId} Actualización estatutos directa`,
    })
    const config = await getLatestConfiguration()
    assert.equal(money(config.tope_gasto_presidente), 1200000)
    assert.equal(money(config.tope_gasto_junta), 3500000)
    assert.match(config.motivo_actualizacion ?? '', new RegExp(context.runId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.equal(Number(config.actualizado_por), Number(admin.id))
    state.adminDirectConfigApplied = true
    return 'Direct Administrator threshold update persisted'
  })

  if (!state.adminDirectConfigApplied) {
    await skippedStep(
      t,
      'A — Statutes and thresholds',
      'A2 — Invalid threshold ordering is rejected',
      'President threshold greater than Junta threshold fails without changing configuration',
      'A1 did not complete, so the expected 1.2M / 3.5M baseline was never established',
    )
  } else {
    await checkedStep(t, 'A — Statutes and thresholds', 'A2 — Invalid threshold ordering is rejected', 'President threshold greater than Junta threshold fails without changing configuration', async () => {
      await expectRpcFailure('komerizo_fijar_cuantias_administrador', {
        p_administrador_id: admin.id,
        p_tope_gasto_presidente: 4000000,
        p_tope_gasto_junta: 3000000,
        p_motivo: `${context.runId} Invalid ordering`,
      })
      const config = await getLatestConfiguration()
      assert.equal(money(config.tope_gasto_presidente), 1200000)
      assert.equal(money(config.tope_gasto_junta), 3500000)
      return 'Invalid configuration rejected atomically'
    })
  }

  await checkedStep(t, 'A — Statutes and thresholds', 'A3 — Secretary creates threshold request', 'A pending Secretary request is persisted', async () => {
    const row = assertNoSupabaseError(
      await supabase.from('komerizo_solicitudes_configuracion_jac').insert({
        secretario_id: secretary.id,
        tope_gasto_presidente: 1500000,
        tope_gasto_junta: 4000000,
        motivo: `${context.runId} Reforma estatutaria Asamblea`,
        estado: 'pendiente',
      }).select().single(),
      'Create Secretary configuration request',
    )
    pushUnique('configurationRequests', row.id)
    assert.equal(row.estado, 'pendiente')
    state.configurationRequestId = row.id
    return `Request ${row.id} pending`
  })

  if (!state.configurationRequestId) {
    await skippedStep(
      t,
      'A — Statutes and thresholds',
      'A4 — Administrator applies Secretary request',
      'Request becomes applied and configuration becomes 1.5M / 4M with Secretary reason',
      'A3 did not create a Secretary configuration request',
    )
  } else {
    await checkedStep(t, 'A — Statutes and thresholds', 'A4 — Administrator applies Secretary request', 'Request becomes applied and configuration becomes 1.5M / 4M with Secretary reason', async () => {
      await expectRpcSuccess('komerizo_aplicar_solicitud_configuracion', {
        p_solicitud_id: state.configurationRequestId,
        p_administrador_id: admin.id,
      })
      const request = await getRow('komerizo_solicitudes_configuracion_jac', state.configurationRequestId)
      const config = await getLatestConfiguration()
      assert.equal(request.estado, 'aplicada')
      assert.equal(money(config.tope_gasto_presidente), 1500000)
      assert.equal(money(config.tope_gasto_junta), 4000000)
      assert.equal(config.motivo_actualizacion, `${context.runId} Reforma estatutaria Asamblea`)
      return 'Secretary-request workflow updated the canonical configuration'
    })
  }

  await checkedStep(t, 'B — Normal President expense', 'B0 — Test fixture funds Treasury through the official income RPC', 'A temporary 5M registered income gives the isolated test enough balance for expense scenarios', async () => {
    const movementId = Number(await expectRpcSuccess('komerizo_registrar_ingreso_financiero', {
      p_monto: state.testFundingAmount,
      p_descripcion: `${context.runId} Fondo temporal de pruebas Phase 2`,
      p_referencia: `TEST-FUND-${context.runId}`,
      p_metodo_pago: 'Transferencia',
      p_origen_tipo: 'phase2_test_funding',
      p_origen_id: treasurer.id,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
    }))
    state.testFundingMovementId = movementId
    await registerMovementDependencies(movementId)
    state.expectedBalance = money(state.expectedBalance + state.testFundingAmount)
    await assertBalance(state.expectedBalance, 'B0')
    return `Temporary official test funding movement ${movementId}; balance ${state.expectedBalance}`
  })

  await checkedStep(t, 'B — Normal President expense', 'B1 — President creates normal expense without invoice but with justification', 'Authorization is pending Treasury and has one created history row', async () => {
    const id = await expectRpcSuccess('komerizo_crear_solicitud_egreso_presidencia', {
      p_presidente_id: president.id,
      p_presidente_rol_id: roles.Presidente,
      p_fecha_egreso: today,
      p_monto: 350000,
      p_concepto: `${context.runId} Transporte actividad comunitaria`,
      p_beneficiario_destino: 'Transportes Prueba',
      p_metodo_pago: 'Efectivo',
      p_justificacion: 'Servicio informal sin factura',
      p_archivo_adjunto_url: null,
      p_organo_responsable: null,
      p_numero_acta: null,
    })
    state.normalAuthorizationId = Number(id)
    pushUnique('authorizations', state.normalAuthorizationId)
    await registerAuthorizationDependencies(state.normalAuthorizationId)
    const row = await readAuthorization(state.normalAuthorizationId)
    assert.equal(row.estado, 'pendiente_tesoreria')
    assert.equal(row.organo_responsable, 'presidencia')
    assert.equal(row.numero_acta, null)
    const histories = assertNoSupabaseError(await supabase.from('komerizo_autorizaciones_gasto_historial').select('id,accion').eq('autorizacion_id', row.id), 'Read created history')
    assert.equal(histories.filter((item) => item.accion === 'creado').length, 1)
    return `Authorization ${row.id} pending Treasury`
  })

  await checkedStep(t, 'B — Normal President expense', 'B2 — Expense without support and justification is rejected', 'No authorization persists', async () => {
    const before = assertNoSupabaseError(
      await supabase.from('komerizo_autorizaciones_gasto').select('id', { count: 'exact', head: true }).eq('concepto', `${context.runId} Invalid no support`),
      'Count invalid expense before',
    )
    assert.equal(before, null)
    await expectRpcFailure('komerizo_crear_solicitud_egreso_presidencia', {
      p_presidente_id: president.id,
      p_presidente_rol_id: roles.Presidente,
      p_fecha_egreso: today,
      p_monto: 100000,
      p_concepto: `${context.runId} Invalid no support`,
      p_beneficiario_destino: 'Proveedor Prueba',
      p_metodo_pago: 'Efectivo',
      p_justificacion: null,
      p_archivo_adjunto_url: null,
      p_organo_responsable: null,
      p_numero_acta: null,
    })
    const result = await supabase.from('komerizo_autorizaciones_gasto').select('id').eq('concepto', `${context.runId} Invalid no support`)
    const rows = assertNoSupabaseError(result, 'Verify rejected expense not persisted')
    assert.equal(rows.length, 0)
    return 'Rejected request left no row'
  })

  await checkedStep(t, 'B — Normal President expense', 'B3 — Treasurer registers normal expense', 'Exactly one 350k expense movement is created and balance decreases once', async () => {
    requirePrerequisite(state.normalAuthorizationId, 'B1 did not create a normal expense authorization')
    const movementId = await expectRpcSuccess('komerizo_registrar_egreso_autorizado', {
      p_autorizacion_id: state.normalAuthorizationId,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
    })
    state.normalMovementId = Number(movementId)
    await registerMovementDependencies(state.normalMovementId)
    await registerAuthorizationDependencies(state.normalAuthorizationId)
    const authorization = await readAuthorization(state.normalAuthorizationId)
    const movement = await readMovement(state.normalMovementId)
    assert.equal(authorization.estado, 'registrado')
    assert.equal(Number(authorization.movimiento_tesoreria_id), state.normalMovementId)
    assert.equal(movement.tipo, 'gasto')
    assert.equal(money(movement.cantidad), 350000)
    assert.equal(movement.estado, 'registrado')
    const duplicateCheck = assertNoSupabaseError(
      await supabase.from('komerizo_tesoreria').select('id').eq('autorizacion_gasto_id', state.normalAuthorizationId),
      'Count movements for normal authorization',
    )
    assert.equal(duplicateCheck.length, 1)
    state.expectedBalance = money(state.expectedBalance - 350000)
    await assertBalance(state.expectedBalance, 'B3')
    return `Movement ${movement.id}; balance ${state.expectedBalance}`
  })

  await checkedStep(t, 'B — Normal President expense', 'B4 — Duplicate Treasurer registration is rejected', 'No second movement and no second balance change', async () => {
    requirePrerequisite(state.normalMovementId, 'B3 did not create the normal Treasury movement')
    await expectRpcFailure('komerizo_registrar_egreso_autorizado', {
      p_autorizacion_id: state.normalAuthorizationId,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
    })
    const rows = assertNoSupabaseError(
      await supabase.from('komerizo_tesoreria').select('id').eq('autorizacion_gasto_id', state.normalAuthorizationId),
      'Verify duplicate registration did not persist',
    )
    assert.equal(rows.length, 1)
    await assertBalance(state.expectedBalance, 'B4')
    return 'Duplicate registration blocked'
  })

  await checkedStep(t, 'C — Above-threshold expense', 'C1 — Above-threshold expense without act/support is rejected', 'RPC rejects incomplete authorization', async () => {
    await expectRpcFailure('komerizo_crear_solicitud_egreso_presidencia', {
      p_presidente_id: president.id,
      p_presidente_rol_id: roles.Presidente,
      p_fecha_egreso: today,
      p_monto: 2500000,
      p_concepto: `${context.runId} Above threshold invalid`,
      p_beneficiario_destino: 'Proveedor Prueba',
      p_metodo_pago: 'Transferencia',
      p_justificacion: 'Compra comunitaria',
      p_archivo_adjunto_url: null,
      p_organo_responsable: null,
      p_numero_acta: null,
    })
    const rows = assertNoSupabaseError(await supabase.from('komerizo_autorizaciones_gasto').select('id').eq('concepto', `${context.runId} Above threshold invalid`), 'Verify invalid high expense absent')
    assert.equal(rows.length, 0)
    return 'Missing act/support rejected'
  })

  await checkedStep(t, 'C — Above-threshold expense', 'C2 — President submits valid Junta-authorized expense', '2.5M request is pending Treasury with act and support', async () => {
    const id = await expectRpcSuccess('komerizo_crear_solicitud_egreso_presidencia', {
      p_presidente_id: president.id,
      p_presidente_rol_id: roles.Presidente,
      p_fecha_egreso: today,
      p_monto: 2500000,
      p_concepto: `${context.runId} Compra materiales comunitarios`,
      p_beneficiario_destino: 'Proveedor Prueba',
      p_metodo_pago: 'Transferencia',
      p_justificacion: 'Compra aprobada',
      p_archivo_adjunto_url: `https://example.invalid/${context.runId}/soporte.pdf`,
      p_organo_responsable: 'junta_directiva',
      p_numero_acta: `${context.runId}-ACTA-024`,
    })
    state.highAuthorizationId = Number(id)
    pushUnique('authorizations', state.highAuthorizationId)
    await registerAuthorizationDependencies(state.highAuthorizationId)
    const row = await readAuthorization(state.highAuthorizationId)
    assert.equal(row.estado, 'pendiente_tesoreria')
    assert.equal(row.organo_responsable, 'junta_directiva')
    assert.equal(row.numero_acta, `${context.runId}-ACTA-024`)
    return `High authorization ${row.id} created`
  })

  await checkedStep(t, 'C — Above-threshold expense', 'C3 — Treasurer returns expense for correction', 'State becomes devuelto_presidente without changing balance', async () => {
    requirePrerequisite(state.highAuthorizationId, 'C2 did not create the above-threshold authorization')
    await expectRpcSuccess('komerizo_devolver_egreso_presidencia', {
      p_autorizacion_id: state.highAuthorizationId,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
      p_motivo: `${context.runId} Falta aclarar beneficiario`,
    })
    await registerAuthorizationDependencies(state.highAuthorizationId)
    const row = await readAuthorization(state.highAuthorizationId)
    assert.equal(row.estado, 'devuelto_presidente')
    assert.match(row.motivo_devolucion ?? '', /Falta aclarar beneficiario/)
    await assertBalance(state.expectedBalance, 'C3')
    state.highReturned = true
    return 'Returned for correction; balance unchanged'
  })

  await checkedStep(t, 'C — Above-threshold expense', 'C4 — President corrects and resends expense', 'State becomes reenviado_tesoreria and return reason clears', async () => {
    requirePrerequisite(state.highReturned, 'C3 did not return the above-threshold authorization for correction')
    await expectRpcSuccess('komerizo_corregir_solicitud_egreso_presidencia', {
      p_autorizacion_id: state.highAuthorizationId,
      p_presidente_id: president.id,
      p_presidente_rol_id: roles.Presidente,
      p_fecha_egreso: today,
      p_monto: 2500000,
      p_concepto: `${context.runId} Compra materiales comunitarios`,
      p_beneficiario_destino: 'Proveedor Prueba Corregido',
      p_metodo_pago: 'Transferencia',
      p_justificacion: 'Compra aprobada',
      p_archivo_adjunto_url: `https://example.invalid/${context.runId}/soporte.pdf`,
      p_organo_responsable: 'junta_directiva',
      p_numero_acta: `${context.runId}-ACTA-024`,
      p_comentario: `${context.runId} Beneficiario corregido`,
    })
    await registerAuthorizationDependencies(state.highAuthorizationId)
    const row = await readAuthorization(state.highAuthorizationId)
    assert.equal(row.estado, 'reenviado_tesoreria')
    assert.equal(row.motivo_devolucion, null)
    assert.equal(row.beneficiario_destino, 'Proveedor Prueba Corregido')
    state.highCorrected = true
    return 'Corrected expense returned to Treasury queue'
  })

  await checkedStep(t, 'C — Above-threshold expense', 'C5 — Treasurer registers corrected expense', 'Exactly one 2.5M movement is created and balance decreases once', async () => {
    requirePrerequisite(state.highCorrected, 'C4 did not correct and resend the above-threshold authorization')
    const movementId = Number(await expectRpcSuccess('komerizo_registrar_egreso_autorizado', {
      p_autorizacion_id: state.highAuthorizationId,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
    }))
    state.highMovementId = movementId
    await registerMovementDependencies(movementId)
    await registerAuthorizationDependencies(state.highAuthorizationId)
    const rows = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id,cantidad').eq('autorizacion_gasto_id', state.highAuthorizationId), 'Verify high-expense movement uniqueness')
    assert.equal(rows.length, 1)
    assert.equal(money(rows[0].cantidad), 2500000)
    state.expectedBalance = money(state.expectedBalance - 2500000)
    await assertBalance(state.expectedBalance, 'C5')
    return `Corrected expense registered; balance ${state.expectedBalance}`
  })

  await checkedStep(t, 'D — Fiscal escalation', 'D1 — Treasurer alerts Fiscal without registering expense', 'Authorization becomes alertado_fiscal; one alert; balance unchanged', async () => {
    const id = Number(await expectRpcSuccess('komerizo_crear_solicitud_egreso_presidencia', {
      p_presidente_id: president.id,
      p_presidente_rol_id: roles.Presidente,
      p_fecha_egreso: today,
      p_monto: 180000,
      p_concepto: `${context.runId} Transporte sin soporte`,
      p_beneficiario_destino: 'Transportador Prueba',
      p_metodo_pago: 'Efectivo',
      p_justificacion: 'Servicio sin comprobante formal',
      p_archivo_adjunto_url: null,
      p_organo_responsable: null,
      p_numero_acta: null,
    }))
    state.alertAuthorizationId = id
    pushUnique('authorizations', id)
    await expectRpcSuccess('komerizo_alertar_egreso_fiscal', {
      p_autorizacion_id: id,
      p_tesorero_id: treasurer.id,
      p_tesorero_rol_id: roles.Tesorero,
      p_motivo: `${context.runId} Justificación insuficiente después de revisión`,
    })
    await registerAuthorizationDependencies(id)
    const auth = await readAuthorization(id)
    assert.equal(auth.estado, 'alertado_fiscal')
    assert.equal(auth.movimiento_tesoreria_id, null)
    const alerts = assertNoSupabaseError(await supabase.from('komerizo_alertas_fiscales').select('*').eq('autorizacion_gasto_id', id).eq('origen', 'tesorero'), 'Read Treasurer Fiscal alert')
    assert.equal(alerts.length, 1)
    state.treasurerAlertId = alerts[0].id
    pushUnique('fiscalAlerts', state.treasurerAlertId)
    const movements = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('autorizacion_gasto_id', id), 'Verify no movement for alerted authorization')
    assert.equal(movements.length, 0)
    await assertBalance(state.expectedBalance, 'D1')
    return `Fiscal alert ${state.treasurerAlertId}; no accounting effect`
  })

  await checkedStep(t, 'D — Fiscal escalation', 'D2 — Fiscal includes Treasurer alert in report queue', 'Alert becomes incluida_reporte and reviewed by Fiscal', async () => {
    requirePrerequisite(state.treasurerAlertId, 'D1 did not create a Treasurer Fiscal alert')
    await expectRpcSuccess('komerizo_incluir_alerta_reporte_fiscal', {
      p_alerta_id: state.treasurerAlertId,
      p_fiscal_id: fiscal.id,
      p_fiscal_rol_id: roles.Fiscal,
      p_comentario: `${context.runId} Se incluirá en auditoría bimestral`,
    })
    const alert = await getRow('komerizo_alertas_fiscales', state.treasurerAlertId)
    assert.equal(alert.estado, 'incluida_reporte')
    assert.equal(Number(alert.revisada_por), Number(fiscal.id))
    await assertBalance(state.expectedBalance, 'D2')
    return 'Treasurer alert reviewed without changing Treasury'
  })

  await checkedStep(t, 'D — Fiscal escalation', 'D3 — Fiscal marks a registered expense and duplicate mark is rejected', 'One Fiscal-origin alert only; balance unchanged', async () => {
    requirePrerequisite(state.normalMovementId, 'B3 did not create a registered expense movement for Fiscal review')
    const alertId = Number(await expectRpcSuccess('komerizo_marcar_egreso_por_fiscal', {
      p_movimiento_id: state.normalMovementId,
      p_fiscal_id: fiscal.id,
      p_fiscal_rol_id: roles.Fiscal,
      p_motivo: `${context.runId} Verificación adicional del soporte`,
    }))
    pushUnique('fiscalAlerts', alertId)
    await registerAuthorizationDependencies(state.normalAuthorizationId)
    await expectRpcFailure('komerizo_marcar_egreso_por_fiscal', {
      p_movimiento_id: state.normalMovementId,
      p_fiscal_id: fiscal.id,
      p_fiscal_rol_id: roles.Fiscal,
      p_motivo: `${context.runId} Intento duplicado`,
    })
    const alerts = assertNoSupabaseError(await supabase.from('komerizo_alertas_fiscales').select('id').eq('movimiento_tesoreria_id', state.normalMovementId).eq('origen', 'fiscal').in('estado', ['abierta', 'incluida_reporte']), 'Count active Fiscal marks')
    assert.equal(alerts.length, 1)
    await assertBalance(state.expectedBalance, 'D3')
    return `Fiscal mark ${alertId}; duplicate blocked`
  })

  await checkedStep(t, 'E — Affiliate information request', 'E1 — Affiliate requests information about one registered expense', 'Pending request references the expense movement', async () => {
    requirePrerequisite(state.normalMovementId, 'B3 did not create a registered expense movement for the affiliate request')
    const row = assertNoSupabaseError(
      await supabase.from('komerizo_solicitud_informes').insert({
        usuario_id: affiliate.id,
        destinatario_rol_id: roles.Tesorero,
        mensaje_solicitud: `${context.runId} Solicito aclaración de este egreso`,
        movimiento_tesoreria_id: state.normalMovementId,
        estado: 'Pendiente',
      }).select().single(),
      'Create affiliate report request',
    )
    state.reportRequestId = row.id
    pushUnique('reportRequests', row.id)
    assert.equal(row.estado, 'Pendiente')
    assert.equal(Number(row.movimiento_tesoreria_id), state.normalMovementId)
    return `Report request ${row.id} pending`
  })

  await checkedStep(t, 'E — Affiliate information request', 'E2 — Unresolved-request query enforces one-at-a-time UX', 'Exactly one unresolved Treasurer request is found', async () => {
    requirePrerequisite(state.reportRequestId, 'E1 did not create an affiliate report request')
    const rows = assertNoSupabaseError(
      await supabase.from('komerizo_solicitud_informes').select('id,estado').eq('usuario_id', affiliate.id).eq('destinatario_rol_id', roles.Tesorero).eq('estado', 'Pendiente'),
      'Read unresolved affiliate requests',
    )
    assert.equal(rows.length, 1)
    assert.equal(Number(rows[0].id), Number(state.reportRequestId))
    return 'Backing query detects the unresolved request'
  })

  await checkedStep(t, 'E — Affiliate information request', 'E3 — Treasurer responds atomically', 'Request becomes Respondido and exactly one formal report is created', async () => {
    requirePrerequisite(state.reportRequestId, 'E1 did not create an affiliate report request')
    const informeId = Number(await expectRpcSuccess('komerizo_responder_solicitud_informe', {
      p_solicitud_id: state.reportRequestId,
      p_usuario_responde_id: treasurer.id,
      p_rol_responde_id: roles.Tesorero,
      p_titulo: `${context.runId} Respuesta al afiliado`,
      p_contenido: 'Detalle de prueba del egreso',
      p_archivo_url: null,
    }))
    pushUnique('informes', informeId)
    const request = await getRow('komerizo_solicitud_informes', state.reportRequestId)
    assert.equal(request.estado, 'Respondido')
    assert.equal(request.titulo_respuesta, `${context.runId} Respuesta al afiliado`)
    assert.ok(request.fecha_respuesta)
    const informes = assertNoSupabaseError(await supabase.from('komerizo_informes').select('*').eq('solicitud_id', state.reportRequestId), 'Read formal response report')
    assert.equal(informes.length, 1)
    assert.equal(informes[0].tipo_informe, 'respuesta_solicitud')
    assert.equal(informes[0].es_publico, false)
    return `Formal report ${informeId} created atomically`
  })

  await checkedStep(t, 'E — Affiliate information request', 'E4 — Duplicate report response is rejected', 'Exactly one formal report remains', async () => {
    requirePrerequisite(state.reportRequestId, 'E1 did not create an affiliate report request')
    await expectRpcFailure('komerizo_responder_solicitud_informe', {
      p_solicitud_id: state.reportRequestId,
      p_usuario_responde_id: treasurer.id,
      p_rol_responde_id: roles.Tesorero,
      p_titulo: `${context.runId} Duplicate response`,
      p_contenido: 'Should fail',
      p_archivo_url: null,
    })
    const informes = assertNoSupabaseError(await supabase.from('komerizo_informes').select('id').eq('solicitud_id', state.reportRequestId), 'Count reports after duplicate response attempt')
    assert.equal(informes.length, 1)
    await assertBalance(state.expectedBalance, 'E4')
    return 'Duplicate response blocked'
  })

  await checkedStep(t, 'Z — Core invariants', 'Z1 — Core financial invariants hold', 'Registered authorizations map 1:1 to movements and alert-only authorization has none', async () => {
    requirePrerequisite(state.normalMovementId && state.highMovementId && state.alertAuthorizationId, 'Core accounting prerequisites B3, C5, or D1 did not complete')
    const normal = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('autorizacion_gasto_id', state.normalAuthorizationId), 'Normal authorization movement invariant')
    const high = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('autorizacion_gasto_id', state.highAuthorizationId), 'High authorization movement invariant')
    const alertOnly = assertNoSupabaseError(await supabase.from('komerizo_tesoreria').select('id').eq('autorizacion_gasto_id', state.alertAuthorizationId), 'Alert-only authorization movement invariant')
    assert.equal(normal.length, 1)
    assert.equal(high.length, 1)
    assert.equal(alertOnly.length, 0)
    assert.equal(money(state.expectedBalance), money(context.baseline.treasuryBalance.saldo_actual) + state.testFundingAmount - 2850000)
    await assertBalance(state.expectedBalance, 'Z1')
    return `Core accounting invariant passed at balance ${state.expectedBalance}`
  })
})
