import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

const execFileAsync = promisify(execFile)

async function selectScope(
  eventName: string,
  requestedPackage: boolean,
  isReleasePullRequest: boolean
): Promise<string> {
  const { stdout } = await execFileAsync('scripts/select-linux-validation-scope.sh', [
    eventName,
    String(requestedPackage),
    String(isReleasePullRequest)
  ])
  return stdout.trim()
}

test('keeps ordinary pull requests on fast verification', async () => {
  await expect(selectScope('pull_request', false, false)).resolves.toBe('false')
})

test('fully packages a strictly recognized Release Please pull request', async () => {
  await expect(selectScope('pull_request', false, true)).resolves.toBe('true')
})

test('honors explicit reusable workflow package modes', async () => {
  await expect(selectScope('workflow_call', true, false)).resolves.toBe('true')
  await expect(selectScope('workflow_call', false, false)).resolves.toBe('false')
})

test('treats reusable calls as workflow_call even when the caller was a push', () => {
  // Release builds call ci.yml from a push, so github.event_name alone is 'push'.
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
  expect(workflow).toContain(
    "EVENT_NAME: ${{ inputs.package_linux == true && 'workflow_call' || github.event_name }}"
  )
})
