import { supabase } from './supabase.mjs'
import { assertNoSupabaseError, getCurrentBalance, getLatestConfiguration } from './helpers.mjs'
import { cleanupCurrentRun } from './cleanup.mjs'

const requiredRoleNames = ['Administrador', 'Secretario', 'Presidente', 'Tesorero', 'Fiscal', 'Usuario']

export const context = {
  runId: process.env.PHASE2_TEST_RUN_ID ?? globalThis.__komerizoPhase2RunId ?? `P2E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  roles: {},
  users: {},
  baseline: { config: null, treasuryBalance: null, maxTreasuryMovementId: 0 },
  created: {
    users: [],
    userRoles: [],
    configurationRequests: [],
    authorizations: [],
    authorizationHistory: [],
    fiscalAlerts: [],
    treasuryMovements: [],
    treasuryHistory: [],
    resourceRentals: [],
    resourceRentalItems: [],
    salonRentals: [],
    salonRentalItems: [],
    donations: [],
    salesActivities: [],
    activityExpenseLinks: [],
    sales: [],
    bonuses: [],
    bonusPurchases: [],
    bonusOccupancy: [],
    reports: [],
    fiscalReports: [],
    reportRequests: [],
    informes: [],
    inventory: [],
  },
}

globalThis.__komerizoPhase2Context = context
globalThis.__komerizoPhase2RunId = context.runId

export function assertWriteAllowed() {
  if (process.env.PHASE2_TEST_ALLOW_WRITE !== 'true') {
    throw new Error('Phase 2 API tests require PHASE2_TEST_ALLOW_WRITE=true')
  }
}

export async function getRoleId(name) {
  const result = await supabase.from('komerizo_roles').select('id,nombre').eq('nombre', name).maybeSingle()
  const role = assertNoSupabaseError(result, `Look up role ${name}`)
  if (!role) throw new Error(`Required role is missing: ${name}`)
  return role.id
}

function uniqueCc(index) {
  return `99${Date.now()}${String(index).padStart(2, '0')}`.slice(0, 20)
}

function uniqueEmail(label) {
  const run = context.runId.toLowerCase().replace(/[^a-z0-9-]/g, '')
  return `phase2-${label}-${run}@example.invalid`
}

async function createUser(user, index) {
  const result = await supabase.from('komerizo_usuarios').insert({
    cc: uniqueCc(index),
    tipo_documento_id: user.tipoDocumentoId,
    nombre: `${user.nombre} ${context.runId}`,
    apellido: user.apellido,
    correo_electronico: uniqueEmail(user.key),
    contrasena: `phase2-fake-${context.runId}`,
    telefono: '3000000000',
    direccion: `Fixture ${context.runId}`,
    estado: 'activo',
    firma: false,
  }).select().single()
  const row = assertNoSupabaseError(result, `Create fixture user ${user.key}`)
  if (!row?.id) throw new Error(`Create fixture user ${user.key} returned no id`)
  context.created.users.push(row.id)
  context.users[user.key] = row
  return row
}

async function assignRole(userKey, roleName) {
  const result = await supabase.from('komerizo_usuario_roles').insert({
    usuario_id: context.users[userKey].id,
    rol_id: context.roles[roleName],
  }).select().single()
  const row = assertNoSupabaseError(result, `Assign ${roleName} to ${userKey}`)
  context.created.userRoles.push(row?.id)
  return row
}

export async function setupPhase2Fixtures() {
  assertWriteAllowed()
  if (context._setupComplete) return context

  try {
    const roleResults = await Promise.all(requiredRoleNames.map(async (name) => [name, await getRoleId(name)]))
    context.roles = Object.fromEntries(roleResults)

    const typeResult = await supabase.from('komerizo_tipo_documento').select('id,nombre,abreviatura').eq('abreviatura', 'CC').maybeSingle()
    const typeDocument = assertNoSupabaseError(typeResult, 'Find CC document type')
    if (!typeDocument) throw new Error('Required document type CC is missing from komerizo_tipo_documento')

    context.baseline.config = await getLatestConfiguration()
    context.baseline.treasuryBalance = await getCurrentBalance()
    const latestMovementResult = await supabase.from('komerizo_tesoreria').select('id').order('id', { ascending: false }).limit(1).maybeSingle()
    const latestMovement = assertNoSupabaseError(latestMovementResult, 'Snapshot latest treasury movement id')
    context.baseline.maxTreasuryMovementId = Number(latestMovement?.id ?? 0)
    if (!context.baseline.config) throw new Error('No current row exists in komerizo_configuracion_jac')
    if (!context.baseline.treasuryBalance) throw new Error('No current row exists in komerizo_tesoreria_saldo')

    const definitions = [
      ['administrator', 'Ana', 'Administradora', 'Administrador'],
      ['secretary', 'Sergio', 'Secretario', 'Secretario'],
      ['president', 'Pedro', 'Presidente', 'Presidente'],
      ['treasurer', 'Tomás', 'Tesorero', 'Tesorero'],
      ['fiscal', 'Fernanda', 'Fiscal', 'Fiscal'],
      ['affiliate1', 'Juan', 'Afiliado', 'Usuario'],
      ['affiliate2', 'María', 'Afiliada', 'Usuario'],
      ['externalPerson', 'Ernesto', 'Externo', null],
    ]
    for (let index = 0; index < definitions.length; index += 1) {
      const [key, nombre, apellido, role] = definitions[index]
      await createUser({ key, nombre, apellido, tipoDocumentoId: typeDocument.id }, index)
      if (role) await assignRole(key, role)
    }

    context._setupComplete = true
    return context
  } catch (error) {
    try {
      await cleanupCurrentRun(context)
    } catch (cleanupError) {
      error.message += `; fixture cleanup also failed: ${cleanupError.message}`
    }
    throw error
  }
}

export async function cleanupPhase2Fixtures() {
  return cleanupCurrentRun(context)
}
