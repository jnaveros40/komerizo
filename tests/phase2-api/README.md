# Komerizo Phase 2 API integration suite

These tests call the real Supabase API. They do not mock the database.

## Safety

The write scenarios create temporary users and business records, then delete them and restore the snapshotted financial configuration/balance.

Run the write suite only against the development/test Supabase project while no other person is actively creating Treasury movements or changing financial configuration. Cleanup detects unrelated Treasury/configuration writes and refuses to blindly restore the baseline if concurrent activity is detected.

## Required local environment

Your existing `.env.local` must contain:

```text
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

The `.env.local` file is intentionally not committed or included in source archives.

## Read-only connectivity

```powershell
npm.cmd run test:phase2:api:connectivity
```

## Full real-write suite (PowerShell)

```powershell
$env:PHASE2_TEST_ALLOW_WRITE="true"
npm.cmd run test:phase2:api
Remove-Item Env:PHASE2_TEST_ALLOW_WRITE
```

The full runner executes sequentially:

1. Connectivity
2. A-E: thresholds, expenses, Treasury, Fiscal, affiliate reports
3. F-L: rentals, shared inventory, Salon, donations, sales, Bonus, reports/statistics
4. M: concurrency, duplicate payments, last-unit/position races and invalid transitions

Consolidated results:

```text
tests/phase2-api/results/latest.md
tests/phase2-api/results/latest.json
```

A non-zero exit code means at least one scenario failed or could not clean up safely.
