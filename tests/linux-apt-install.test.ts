import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []

// Fake sudo/timeout pass through; the fake apt-get logs each call and fails
// the first FAILURES "update" calls, like a stalled mirror.
async function runInstaller(failures: number): Promise<{ ok: boolean; calls: string[] }> {
  const directory = await mkdtemp(join(tmpdir(), 'apt-install-'))
  temporaryDirectories.push(directory)
  const log = join(directory, 'calls')
  await Promise.all([
    writeFile(join(directory, 'sudo'), '#!/bin/bash\nexec "$@"\n', { mode: 0o700 }),
    writeFile(join(directory, 'timeout'), '#!/bin/bash\nshift\nexec "$@"\n', { mode: 0o700 }),
    writeFile(
      join(directory, 'apt-get'),
      `#!/bin/bash
echo "$*" >> "${log}"
if [[ " $* " == *" update "* ]]; then
  count=$(grep -c ' update' "${log}")
  [[ "$count" -gt ${failures} ]] || exit 100
fi
`,
      { mode: 0o700 }
    ),
    writeFile(log, '')
  ])
  try {
    await execFileAsync('scripts/apt-install.sh', ['libusb-1.0-0-dev', 'libudev-dev'], {
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        APT_RETRY_DELAY_SECONDS: '0'
      }
    })
    return { ok: true, calls: (await readFile(log, 'utf8')).trim().split('\n') }
  } catch {
    return { ok: false, calls: (await readFile(log, 'utf8')).trim().split('\n') }
  }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

test('installs with bounded apt network timeouts', async () => {
  const { ok, calls } = await runInstaller(0)
  expect(ok).toBe(true)
  expect(calls).toHaveLength(2)
  expect(calls[0]).toMatch(/Acquire::Retries=3 .*Acquire::https::Timeout=30 .* update$/)
  expect(calls[1]).toMatch(/ install -y libusb-1\.0-0-dev libudev-dev$/)
})

test('retries when a mirror stalls, then gives up after three attempts', async () => {
  const recovered = await runInstaller(2)
  expect(recovered.ok).toBe(true)
  expect(recovered.calls.filter((call) => call.endsWith(' update'))).toHaveLength(3)

  const failed = await runInstaller(3)
  expect(failed.ok).toBe(false)
  expect(failed.calls).toHaveLength(3)
  expect(failed.calls.every((call) => call.endsWith(' update'))).toBe(true)
})

test('CI installs Ubuntu packages only through the bounded installer', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8')
  expect(workflow).not.toMatch(/apt-get/)
  expect(workflow.match(/timeout-minutes: 20\n {8}run: scripts\/apt-install\.sh /g)).toHaveLength(2)
})
