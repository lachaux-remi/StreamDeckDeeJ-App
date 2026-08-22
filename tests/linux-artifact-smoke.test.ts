import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []

async function runSmoke(
  body: string,
  timeoutSeconds = '1'
): Promise<{
  error?: Error & { stdout?: string; stderr?: string }
  log: string
  output: string
}> {
  const directory = await mkdtemp(join(tmpdir(), 'streamdeck-deej-smoke-'))
  temporaryDirectories.push(directory)
  const executable = join(directory, 'fake-app')
  const log = join(directory, 'smoke.log')
  await writeFile(executable, `#!/bin/bash\nset -eu\n${body}\n`, { mode: 0o700 })

  try {
    const { stdout, stderr } = await execFileAsync(
      'scripts/smoke-linux-artifact.sh',
      [executable, log],
      {
        env: {
          ...process.env,
          SMOKE_POLL_INTERVAL_SECONDS: '0.05',
          SMOKE_TIMEOUT_SECONDS: timeoutSeconds
        }
      }
    )
    return { log: await readFile(log, 'utf8'), output: `${stdout}${stderr}` }
  } catch (error) {
    const processError = error as Error & { stdout?: string; stderr?: string }
    return {
      error: processError,
      log: await readFile(log, 'utf8'),
      output: `${processError.stdout || ''}${processError.stderr || ''}`
    }
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

test('waits for readiness and terminates the live application', async () => {
  const result = await runSmoke(
    `
trap 'echo terminated; exit 0' TERM
echo 'Linux updater mode: disabled'
while true; do sleep 1; done`,
    '3'
  )

  expect(result.error).toBeUndefined()
  expect(result.log).toContain('Linux updater mode: disabled')
  expect(result.log).toContain('terminated')
})

test('prints the log when readiness never arrives', async () => {
  const result = await runSmoke(`
echo 'started without readiness'
while true; do sleep 1; done`)

  expect(result.error).toBeDefined()
  expect(result.output).toContain('started without readiness')
  expect(result.output).toMatch(/readiness marker.*1 seconds/i)
})

test('prints the log and fails immediately on a main-process exception', async () => {
  const result = await runSmoke(`
echo 'A JavaScript error occurred in the main process'
while true; do sleep 1; done`)

  expect(result.error).toBeDefined()
  expect(result.output).toContain('A JavaScript error occurred in the main process')
  expect(result.output).toMatch(/main-process exception/i)
})

test('prints the log and exit status when the application crashes before readiness', async () => {
  const result = await runSmoke(`
echo 'crashed during startup'
exit 42`)

  expect(result.error).toBeDefined()
  expect(result.output).toContain('crashed during startup')
  expect(result.output).toContain('status 42')
})
