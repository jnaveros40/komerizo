import { supabase } from './supabase.mjs'

function ids(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))]
}

async function removeByIds(table, values, failures) {
  const rowIds = ids(values)
  if (!rowIds.length) return
  const result = await supabase.from(table).delete().in('id', rowIds)
  if (result.error) failures.push(`${table}: ${result.error.message}`)
}

async function updateByIds(table, values, changes, failures) {
  const rowIds = ids(values)
  if (!rowIds.length) return
  const result = await supabase.from(table).update(changes).in('id', rowIds)
  if (result.error) failures.push(`${table} update: ${result.error.message}`)
}

async function removeCompositeRows(table, entries, keys, failures) {
  for (const entry of entries ?? []) {
    if (!entry || keys.some((key) => entry[key] === undefined || entry[key] === null)) continue
    let query = supabase.from(table).delete()
    for (const key of keys) query = query.eq(key, entry[key])
    const result = await query
    if (result.error) failures.push(`${table}: ${result.error.message}`)
  }
}

export async function cleanupCurrentRun(context) {
  const failures = []
  const c = context.created

  // Discover rows created by fixture users even when a test expected an RPC to fail
  // but an older/deployed function unexpectedly persisted data before the assertion failed.
  // Fixture user IDs are unique to this run, so these lookups cannot capture real user data.
  const fixtureUserIds = ids(c.users)
  if (fixtureUserIds.length) {
    const resourceRentals = await supabase
      .from('komerizo_alquiler_recursos')
      .select('id,tesoreria_movimiento_id,deposito_movimiento_id')
      .in('creado_por', fixtureUserIds)
    if (resourceRentals.error) {
      failures.push(`Discover fixture resource rentals: ${resourceRentals.error.message}`)
    } else {
      for (const row of resourceRentals.data ?? []) {
        if (!c.resourceRentals.includes(row.id)) c.resourceRentals.push(row.id)
        for (const movementId of [row.tesoreria_movimiento_id, row.deposito_movimiento_id]) {
          if (movementId && !c.treasuryMovements.includes(movementId)) c.treasuryMovements.push(movementId)
        }
      }
    }

    const salonRentals = await supabase
      .from('komerizo_alquileres')
      .select('id,tesoreria_movimiento_id')
      .in('usuario_id', fixtureUserIds)
    if (salonRentals.error) {
      failures.push(`Discover fixture Salon rentals: ${salonRentals.error.message}`)
    } else {
      for (const row of salonRentals.data ?? []) {
        if (!c.salonRentals.includes(row.id)) c.salonRentals.push(row.id)
        if (row.tesoreria_movimiento_id && !c.treasuryMovements.includes(row.tesoreria_movimiento_id)) {
          c.treasuryMovements.push(row.tesoreria_movimiento_id)
        }
      }
    }
  }

  if (c.resourceRentals.length) {
    const items = await supabase.from('komerizo_alquiler_recursos_items').select('id').in('alquiler_id', ids(c.resourceRentals))
    if (items.error) failures.push(`Discover fixture resource-rental items: ${items.error.message}`)
    else for (const row of items.data ?? []) if (!c.resourceRentalItems.includes(row.id)) c.resourceRentalItems.push(row.id)
  }
  if (c.salonRentals.length) {
    const items = await supabase.from('komerizo_alquiler_items').select('id').in('alquiler_id', ids(c.salonRentals))
    if (items.error) failures.push(`Discover fixture Salon items: ${items.error.message}`)
    else for (const row of items.data ?? []) if (!c.salonRentalItems.includes(row.id)) c.salonRentalItems.push(row.id)
  }
  if (c.treasuryMovements.length) {
    const histories = await supabase.from('komerizo_tesoreria_historial').select('id').in('movimiento_id', ids(c.treasuryMovements))
    if (histories.error) failures.push(`Discover fixture treasury histories: ${histories.error.message}`)
    else for (const row of histories.data ?? []) if (!c.treasuryHistory.includes(row.id)) c.treasuryHistory.push(row.id)
  }

  // Break the intentional two-way references between authorizations and treasury.
  await updateByIds('komerizo_autorizaciones_gasto', c.authorizations, { movimiento_tesoreria_id: null }, failures)
  await updateByIds('komerizo_tesoreria', c.treasuryMovements, { autorizacion_gasto_id: null }, failures)
  await updateByIds('komerizo_alquiler_recursos', c.resourceRentals, { tesoreria_movimiento_id: null, deposito_movimiento_id: null }, failures)
  await updateByIds('komerizo_alquileres', c.salonRentals, { tesoreria_movimiento_id: null }, failures)
  await updateByIds('komerizo_bonos_solidarios', c.bonuses, { movimiento_premio_no_entregado_id: null }, failures)
  await updateByIds('komerizo_solicitud_informes', c.reportRequests, { movimiento_tesoreria_id: null }, failures)

  // Reverse FK dependency order. Every delete is restricted to IDs registered by this run.
  await removeByIds('komerizo_reportes_financieros', c.reports, failures)
  await removeByIds('komerizo_reportes_fiscales', c.fiscalReports, failures)
  await removeByIds('komerizo_informes', c.informes, failures)
  await removeByIds('komerizo_solicitud_informes', c.reportRequests, failures)

  await removeCompositeRows('komerizo_bono_puestos_ocupados', c.bonusOccupancy, ['bono_id', 'numero_puesto'], failures)
  await removeByIds('komerizo_bono_compras', c.bonusPurchases, failures)
  await removeByIds('komerizo_bonos_solidarios', c.bonuses, failures)

  await removeCompositeRows('komerizo_actividad_venta_egresos', c.activityExpenseLinks, ['actividad_id', 'movimiento_tesoreria_id'], failures)
  await removeByIds('komerizo_ventas_actividad', c.sales, failures)
  await removeByIds('komerizo_actividades_venta', c.salesActivities, failures)

  await removeByIds('komerizo_alquiler_recursos_items', c.resourceRentalItems, failures)
  await removeByIds('komerizo_alquiler_recursos', c.resourceRentals, failures)
  await removeByIds('komerizo_alquiler_items', c.salonRentalItems, failures)
  await removeByIds('komerizo_alquileres', c.salonRentals, failures)

  await removeByIds('komerizo_ingresos_donaciones_cuotas', c.donations, failures)
  await removeByIds('komerizo_alertas_fiscales', c.fiscalAlerts, failures)
  await removeByIds('komerizo_autorizaciones_gasto_historial', c.authorizationHistory, failures)
  await removeByIds('komerizo_tesoreria_historial', c.treasuryHistory, failures)
  await removeByIds('komerizo_tesoreria', c.treasuryMovements, failures)
  await removeByIds('komerizo_autorizaciones_gasto', c.authorizations, failures)
  await removeByIds('komerizo_solicitudes_configuracion_jac', c.configurationRequests, failures)
  await removeByIds('komerizo_inventario', c.inventory, failures)

  // Restore global baseline only if no unrelated Treasury writes appeared while the test was running.
  // This prevents the cleanup from overwriting legitimate concurrent application activity.
  const baselineBalance = context.baseline?.treasuryBalance
  const baselineMaxMovementId = Number(context.baseline?.maxTreasuryMovementId ?? 0)
  let externalTreasuryWrites = []
  if (baselineBalance?.id) {
    const newer = await supabase.from('komerizo_tesoreria').select('id').gt('id', baselineMaxMovementId)
    if (newer.error) {
      failures.push(`Check concurrent treasury writes: ${newer.error.message}`)
    } else {
      const ours = new Set(ids(c.treasuryMovements).map(Number))
      externalTreasuryWrites = (newer.data ?? []).map((row) => Number(row.id)).filter((id) => !ours.has(id))
    }

    if (externalTreasuryWrites.length) {
      failures.push(`Treasury baseline NOT restored because unrelated movement(s) appeared during the test: ${externalTreasuryWrites.join(', ')}`)
    } else {
      const result = await supabase.from('komerizo_tesoreria_saldo').update({
        saldo_actual: baselineBalance.saldo_actual,
        saldo_anterior: baselineBalance.saldo_anterior,
      }).eq('id', baselineBalance.id)
      if (result.error) failures.push(`Restore treasury balance ${baselineBalance.id}: ${result.error.message}`)
    }
  }

  const baselineConfig = context.baseline?.config
  if (baselineConfig?.id) {
    const hasReasonColumn = Object.prototype.hasOwnProperty.call(baselineConfig, 'motivo_actualizacion')
    const currentColumns = hasReasonColumn ? 'id,actualizado_por,motivo_actualizacion' : 'id,actualizado_por'
    const currentConfig = await supabase.from('komerizo_configuracion_jac').select(currentColumns).eq('id', baselineConfig.id).maybeSingle()
    if (currentConfig.error) {
      failures.push(`Check concurrent financial configuration writes: ${currentConfig.error.message}`)
    } else {
      const fixtureAdminId = context.users?.administrator?.id
      const reason = hasReasonColumn ? String(currentConfig.data?.motivo_actualizacion ?? '') : ''
      const looksLikeOurChange = Number(currentConfig.data?.actualizado_por) === Number(fixtureAdminId) || (hasReasonColumn && reason.includes(context.runId))
      const unchanged = Number(currentConfig.data?.actualizado_por ?? 0) === Number(baselineConfig.actualizado_por ?? 0)
        && (!hasReasonColumn || reason === String(baselineConfig.motivo_actualizacion ?? ''))
      if (!unchanged && !looksLikeOurChange) {
        failures.push('Financial configuration baseline NOT restored because an unrelated configuration change appeared during the test')
      } else {
        const restoreConfig = {
          tope_gasto_presidente: baselineConfig.tope_gasto_presidente,
          tope_gasto_junta: baselineConfig.tope_gasto_junta,
          actualizado_por: baselineConfig.actualizado_por ?? null,
          fecha_actualizacion: baselineConfig.fecha_actualizacion,
        }
        if (hasReasonColumn) restoreConfig.motivo_actualizacion = baselineConfig.motivo_actualizacion ?? null
        const result = await supabase.from('komerizo_configuracion_jac').update(restoreConfig).eq('id', baselineConfig.id)
        if (result.error) failures.push(`Restore financial configuration ${baselineConfig.id}: ${result.error.message}`)
      }
    }
  }

  await removeByIds('komerizo_usuario_roles', c.userRoles, failures)
  await removeByIds('komerizo_usuarios', c.users, failures)

  if (failures.length) {
    throw new Error(`Phase 2 cleanup had ${failures.length} failure(s):\n${failures.join('\n')}`)
  }
  context._setupComplete = false
  return { ok: true }
}
