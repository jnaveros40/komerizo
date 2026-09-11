import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const files = [
  ['00-connectivity', 'tests/phase2-api/00-connectivity.test.mjs', false],
  ['10-core-financial', 'tests/phase2-api/10-core-financial.test.mjs', true],
  ['20-operational-flows', 'tests/phase2-api/20-operational-flows.test.mjs', true],
  ['30-stress-and-invariants', 'tests/phase2-api/30-stress-and-invariants.test.mjs', true],
]

if (!existsSync(resolve('.env.local'))) {
  process.stderr.write('Missing .env.local. The real Supabase API suite must run from a checkout that contains your local Supabase environment variables.\n')
  process.exit(1)
}

const runId = `P2E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
const partsDir = resolve('tests/phase2-api/results/parts')
rmSync(partsDir, { recursive: true, force: true })
mkdirSync(partsDir, { recursive: true })

let childFailure = false
for (const [part, file, writes] of files) {
  if (writes && process.env.PHASE2_TEST_ALLOW_WRITE !== 'true') {
    process.stderr.write(`Skipping ${file}: PHASE2_TEST_ALLOW_WRITE=true is required for real write scenarios.\n`)
    childFailure = true
    continue
  }
  process.stdout.write(`\n=== ${part} ===\n`)
  const child = spawnSync(process.execPath, [
    '--env-file=.env.local',
    '--test',
    '--test-concurrency=1',
    file,
  ], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PHASE2_TEST_RUN_ID: runId,
      PHASE2_TEST_REPORT_PART: part,
    },
    stdio: 'inherit',
  })
  if (child.status !== 0) childFailure = true
}

const results = []
for (const [part] of files) {
  const path = resolve(`tests/phase2-api/results/parts/${part}.json`)
  if (!existsSync(path)) continue
  const payload = JSON.parse(readFileSync(path, 'utf8'))
  for (const result of payload.results ?? []) results.push(result)
}

const summary = {
  passed: results.filter((item) => item.status === 'passed').length,
  failed: results.filter((item) => item.status === 'failed').length,
  skipped: results.filter((item) => item.status === 'skipped').length,
}
const payload = { runId, date: new Date().toISOString(), summary, results }
writeFileSync(resolve('tests/phase2-api/results/latest.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

const lines = [
  '# Komerizo Phase 2 API Test Report', '',
  `Run: ${runId}`, `Date: ${payload.date}`, '',
  '## Summary', `Passed: ${summary.passed}`, `Failed: ${summary.failed}`, `Skipped: ${summary.skipped}`, '',
  '## Scenarios',
]
for (const item of results) {
  const icon = item.status === 'passed' ? '✅' : item.status === 'skipped' ? '⏭️' : '❌'
  lines.push('', `### ${item.scenario}`, `- ${icon} ${item.step} (${item.duration ?? 0} ms)`)
  if (item.status !== 'passed') {
    lines.push(`  Expected: ${item.expected ?? ''}`, `  Actual: ${item.actual ?? ''}`, `  Error: ${item.error ?? ''}`)
  }
}
writeFileSync(resolve('tests/phase2-api/results/latest.md'), `${lines.join('\n')}\n`, 'utf8')

process.stdout.write(`\nConsolidated report: tests/phase2-api/results/latest.md\n`)
process.stdout.write(`Passed ${summary.passed}; Failed ${summary.failed}; Skipped ${summary.skipped}\n`)
process.exit(childFailure || summary.failed ? 1 : 0)
