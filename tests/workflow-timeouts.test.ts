import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { expect, test } from 'vitest'

interface Workflow {
  jobs: Record<string, { uses?: string; 'runs-on'?: unknown; 'timeout-minutes'?: unknown }>
}

const workflowDirectory = '.github/workflows'
const runnerJobs = readdirSync(workflowDirectory)
  .filter((name) => name.endsWith('.yml'))
  .flatMap((name) => {
    const workflow = load(readFileSync(join(workflowDirectory, name), 'utf8')) as Workflow
    return Object.entries(workflow.jobs)
      .filter(([, job]) => job.uses === undefined)
      .map(([id, job]) => ({ id: `${name}:${id}`, timeout: job['timeout-minutes'] }))
  })

test('finds the runner jobs of every workflow', () => {
  expect(runnerJobs.map(({ id }) => id)).toEqual(
    expect.arrayContaining([
      'ci.yml:verify',
      'ci-windows.yml:windows-x64',
      'release.yml:publish-release'
    ])
  )
})

// GitHub's default is 360 minutes: a stalled runner (for example a hung apt-get)
// would otherwise hold a CI or release job for six hours.
test.each(runnerJobs)('$id has an explicit timeout of at most an hour', ({ timeout }) => {
  expect(timeout).toEqual(expect.any(Number))
  expect(timeout as number).toBeGreaterThan(0)
  expect(timeout as number).toBeLessThanOrEqual(60)
})
