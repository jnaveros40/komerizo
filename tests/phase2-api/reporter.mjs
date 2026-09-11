import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const results = []
const runId = process.env.PHASE2_TEST_RUN_ID ?? globalThis.__komerizoPhase2RunId ?? `P2E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
globalThis.__komerizoPhase2RunId = runId

export function getRunId() {
  return globalThis.__komerizoPhase2RunId
}

export function record({ scenario, step, status, expected = '', actual = '', error = '', duration = 0 }) {
  results.push({
    scenario,
    step,
    status,
    expected,
    actual,
    error: error instanceof Error ? error.message : error,
    duration,
  })
}

export function getResults() {
  return [...results]
}

function markdown() {
  const passed = results.filter((item) => item.status === 'passed').length
  const failed = results.filter((item) => item.status === 'failed').length
  const skipped = results.filter((item) => item.status === 'skipped').length
  const lines = [
    '# Komerizo Phase 2 API Test Report',
    '',
    `Run: ${getRunId()}`,
    `Date: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `Passed: ${passed}`,
    `Failed: ${failed}`,
    `Skipped: ${skipped}`,
    '',
    '## Scenarios',
  ]
  for (const item of results) {
    const icon = item.status === 'passed' ? '✅' : item.status === 'skipped' ? '⏭️' : '❌'
    lines.push(``, `### ${item.scenario}`, `- ${icon} ${item.step} (${item.duration} ms)`)
    if (item.status !== 'passed') {
      lines.push(`  Expected: ${item.expected}`, `  Actual: ${item.actual}`, `  Error: ${item.error}`)
    }
  }
  return `${lines.join('\n')}\n`
}

export function writeReport() {
  const part = process.env.PHASE2_TEST_REPORT_PART
  const base = part ? `tests/phase2-api/results/parts/${part}` : 'tests/phase2-api/results/latest'
  mkdirSync(dirname(resolve(`${base}.json`)), { recursive: true })
  writeFileSync(resolve(`${base}.json`), `${JSON.stringify({
    runId: getRunId(),
    date: new Date().toISOString(),
    results,
  }, null, 2)}\n`, 'utf8')
  writeFileSync(resolve(`${base}.md`), markdown(), 'utf8')
}

process.once('exit', () => {
  try {
    writeReport()
  } catch (error) {
    process.stderr.write(`Unable to write Phase 2 API report: ${error.message}\n`)
  }
})
