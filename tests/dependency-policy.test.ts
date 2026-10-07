import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const lockfile = readFileSync('pnpm-lock.yaml', 'utf8')
const workspace = readFileSync('pnpm-workspace.yaml', 'utf8')

// GHSA-hp3w-g68c-fv3c has no patched sprintf-js release: it is removed by
// forcing global-agent 4, which no longer depends on roarr and sprintf-js.
test('keeps the unpatched sprintf-js advisory out of the dependency tree', () => {
  expect(lockfile).not.toMatch(/^ {2}'?sprintf-js@/m)
  expect(lockfile).not.toMatch(/^ {2}'?roarr@/m)
  expect(lockfile).toMatch(/^ {2}'?global-agent@4\./m)
  expect(workspace).toContain('global-agent@<4: ^4.1.3')
})

test('does not silence any advisory in pnpm audit', () => {
  expect(workspace).not.toMatch(/ignoreGhsas|ignoreCves/)
})
