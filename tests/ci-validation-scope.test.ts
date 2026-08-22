import { execFile } from 'node:child_process'
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
