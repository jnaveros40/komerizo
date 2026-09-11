import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { record, writeReport } from './reporter.mjs'

let supabaseModule

async function client() {
  if (!supabaseModule) supabaseModule = await import('./supabase.mjs')
  return supabaseModule.supabase
}

async function checkedRead(label, table) {
  const started = Date.now()
  try {
    const supabase = await client()
    const result = await supabase.from(table).select('*').limit(1)
    if (result.error) throw new Error(`${result.error.message}${result.error.details ? ` | ${result.error.details}` : ''}`)
    record({ scenario: 'A — Connectivity', step: label, status: 'passed', expected: 'A harmless read succeeds', actual: 'Read succeeded', duration: Date.now() - started })
    return result.data
  } catch (error) {
    record({ scenario: 'A — Connectivity', step: label, status: 'failed', expected: 'A harmless read succeeds', actual: 'Read failed', error, duration: Date.now() - started })
    throw error
  }
}

async function checked(label, expected, action) {
  const started = Date.now()
  try {
    const actual = await action()
    record({ scenario: 'A — Connectivity', step: label, status: 'passed', expected, actual: typeof actual === 'string' ? actual : 'Condition satisfied', duration: Date.now() - started })
    return actual
  } catch (error) {
    record({ scenario: 'A — Connectivity', step: label, status: 'failed', expected, actual: 'Condition failed', error, duration: Date.now() - started })
    throw error
  }
}

test('A1 — required Supabase environment variables exist', async () => {
  await checked(
    'A1 — Environment variables',
    'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are present',
    async () => {
      assert.ok(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL is missing')
      assert.ok(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing')
      return 'Both variables are present'
    },
  )
})

test('A2 — Supabase responds', async () => {
  await checkedRead('A2 — Supabase response', 'komerizo_roles')
})

test('A3 — required roles exist', async () => {
  await checked('A3 — Required roles', 'All six required roles are readable', async () => {
    const supabase = await client()
    const required = ['Administrador', 'Secretario', 'Presidente', 'Tesorero', 'Fiscal', 'Usuario']
    const result = await supabase.from('komerizo_roles').select('id,nombre').in('nombre', required)
    if (result.error) throw new Error(result.error.message)
    const found = new Set((result.data ?? []).map((row) => row.nombre))
    const missing = required.filter((name) => !found.has(name))
    assert.deepEqual(missing, [], `Missing required roles: ${missing.join(', ')}`)
    return `${required.length} roles found`
  })
})

test('A4 — financial configuration is readable', async () => {
  await checkedRead('A4 — Financial configuration', 'komerizo_configuracion_jac')
})

test('A5 — treasury balance is readable', async () => {
  await checkedRead('A5 — Treasury balance', 'komerizo_tesoreria_saldo')
})

const phase2Tables = [
  'komerizo_autorizaciones_gasto',
  'komerizo_alertas_fiscales',
  'komerizo_tesoreria',
  'komerizo_alquiler_recursos',
  'komerizo_ingresos_donaciones_cuotas',
  'komerizo_actividades_venta',
  'komerizo_ventas_actividad',
  'komerizo_bonos_solidarios',
  'komerizo_bono_compras',
  'komerizo_reportes_financieros',
  'komerizo_reportes_fiscales',
  'komerizo_solicitud_informes',
  'komerizo_informes',
]

test('A6 — required Phase 2 tables are reachable', async () => {
  await checked('A6 — Phase 2 table reads', 'Every required table accepts a limit(1) read', async () => {
    for (const table of phase2Tables) await checkedRead(`A6 — ${table}`, table)
    return `${phase2Tables.length} tables reachable`
  })
})

after(() => {
  writeReport()
})
