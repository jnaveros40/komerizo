import assert from 'node:assert/strict'
import { supabase } from './supabase.mjs'

function formatSupabaseError(error) {
  if (!error) return ''
  const parts = [error.message, error.code && `code=${error.code}`, error.details, error.hint]
  return parts.filter(Boolean).join(' | ')
}

export function assertNoSupabaseError(result, label = 'Supabase request') {
  if (result?.error) {
    throw new Error(`${label} failed: ${formatSupabaseError(result.error)}`)
  }
  return result?.data
}

export async function expectRpcSuccess(name, params = {}) {
  const result = await supabase.rpc(name, params)
  return assertNoSupabaseError(result, `RPC ${name}`)
}

export async function expectRpcFailure(name, params = {}, messageFragment) {
  const result = await supabase.rpc(name, params)
  assert.ok(result.error, `RPC ${name} was expected to fail`)
  const message = formatSupabaseError(result.error)
  if (messageFragment) {
    assert.match(message.toLowerCase(), String(messageFragment).toLowerCase())
  }
  return result.error
}

export async function getCurrentBalance() {
  const result = await supabase
    .from('komerizo_tesoreria_saldo')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return assertNoSupabaseError(result, 'Read current treasury balance')
}

export async function getLatestConfiguration() {
  const result = await supabase
    .from('komerizo_configuracion_jac')
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()
  return assertNoSupabaseError(result, 'Read latest financial configuration')
}

export async function findRoleId(name) {
  const result = await supabase.from('komerizo_roles').select('id,nombre').eq('nombre', name).maybeSingle()
  const role = assertNoSupabaseError(result, `Find role ${name}`)
  if (!role) throw new Error(`Required role is missing: ${name}`)
  return role.id
}

function applyFilters(query, filters = {}) {
  let next = query
  for (const [column, value] of Object.entries(filters)) {
    if (Array.isArray(value)) next = next.in(column, value)
    else if (value === null) next = next.is(column, null)
    else next = next.eq(column, value)
  }
  return next
}

export async function countRows(table, filters = {}) {
  const result = await applyFilters(
    supabase.from(table).select('id', { count: 'exact', head: true }),
    filters,
  )
  assertNoSupabaseError(result, `Count rows in ${table}`)
  return result.count ?? 0
}

export async function getRow(table, id) {
  const result = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  return assertNoSupabaseError(result, `Read ${table} ${id}`)
}

export function money(value) {
  return Number(Number(value ?? 0).toFixed(2))
}

export function dateLocalString(date = new Date()) {
  const value = date instanceof Date ? date : new Date(date)
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function uniqueDocument(prefix = 'P2') {
  const runId = globalThis.__komerizoPhase2Context?.runId ?? 'P2E2E-unbound'
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${runId}-${suffix}`.slice(0, 50)
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function assertExactlyOneTreasuryMovement(filters, label = 'Treasury movement') {
  const result = await applyFilters(
    supabase.from('komerizo_tesoreria').select('*'),
    filters,
  )
  const rows = assertNoSupabaseError(result, `Find ${label}`)
  assert.equal(rows.length, 1, `${label}: expected exactly one row, found ${rows.length}`)
  return rows[0]
}

export { formatSupabaseError }

