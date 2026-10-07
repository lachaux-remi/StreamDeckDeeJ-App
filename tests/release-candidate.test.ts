import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { load } from 'js-yaml'
import { afterEach, expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const temporaryDirectories: string[] = []
const repository = 'lachaux-remi/StreamDeckDeeJ-App'
const releaseSha = 'a'.repeat(40)
const laterSha = 'b'.repeat(40)

interface Workflow {
  jobs: Record<string, { steps: Array<{ id?: string; run?: string }> }>
}

const candidateScript = (
  load(readFileSync('.github/workflows/release.yml', 'utf8')) as Workflow
).jobs['release-candidate'].steps.find((step) => step.id === 'candidate')?.run as string

interface PullRequest {
  number: number
  merged: boolean
  merged_at: string | null
  merge_commit_sha: string
  base: { ref: string }
  head: { ref: string; repo: { full_name: string } }
  labels: Array<{ name: string }>
}

function releasePullRequest(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    number: 47,
    merged: true,
    merged_at: '2026-10-06T21:27:37Z',
    merge_commit_sha: releaseSha,
    base: { ref: 'main' },
    head: {
      ref: 'release-please--branches--main--components--streamdeck-deej',
      repo: { full_name: repository }
    },
    labels: [{ name: 'autorelease: pending' }],
    ...overrides
  }
}

// Serves the GitHub API responses used by the candidate step from fixtures.
const fakeGh = `#!/bin/bash
set -eu
url=''
for argument in "$@"; do
  case "$argument" in repos/*) url="$argument" ;; esac
done
case "$url" in
  */commits/*/pulls*) cat "$FIXTURES/commit-pulls.json" ;;
  */pulls\\?state=closed*) cat "$FIXTURES/closed-pulls.json" ;;
  */pulls/*) cat "$FIXTURES/pull-\${url##*/}.json" ;;
  */compare/*) cat "$FIXTURES/compare-status" ;;
  *) echo "unexpected gh call: $*" >&2; exit 1 ;;
esac
`

async function detect(options: {
  eventSha: string
  commitPulls: PullRequest[]
  closedPulls: PullRequest[]
  compareStatus?: string
}): Promise<Record<string, string>> {
  const directory = await mkdtemp(join(tmpdir(), 'release-candidate-'))
  temporaryDirectories.push(directory)
  const output = join(directory, 'github-output')
  await Promise.all([
    writeFile(join(directory, 'gh'), fakeGh, { mode: 0o700 }),
    writeFile(join(directory, 'commit-pulls.json'), JSON.stringify(options.commitPulls)),
    writeFile(join(directory, 'closed-pulls.json'), JSON.stringify([options.closedPulls])),
    writeFile(join(directory, 'compare-status'), `${options.compareStatus ?? 'ahead'}\n`),
    writeFile(output, ''),
    ...options.closedPulls.map((pr) =>
      writeFile(join(directory, `pull-${pr.number}.json`), JSON.stringify(pr))
    )
  ])

  await execFileAsync('bash', ['-c', candidateScript], {
    env: {
      ...process.env,
      PATH: `${directory}:${process.env.PATH}`,
      FIXTURES: directory,
      GITHUB_OUTPUT: output,
      BASE_REF: 'main',
      EVENT_REF: 'refs/heads/main',
      EVENT_SHA: options.eventSha,
      REPOSITORY: repository
    }
  })
  return Object.fromEntries(
    (await readFile(output, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => line.split('=') as [string, string])
  )
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

test('releases the merge commit of the pending Release Please pull request', async () => {
  const pr = releasePullRequest()
  await expect(
    detect({ eventSha: releaseSha, commitPulls: [pr], closedPulls: [pr] })
  ).resolves.toEqual({ release: 'true', sha: releaseSha })
})

test('resumes a pending release from a later main commit at the release merge commit', async () => {
  const pr = releasePullRequest()
  await expect(
    detect({ eventSha: laterSha, commitPulls: [], closedPulls: [pr], compareStatus: 'ahead' })
  ).resolves.toEqual({ release: 'true', sha: releaseSha })
})

test('does not release ordinary pushes without a pending release', async () => {
  await expect(detect({ eventSha: laterSha, commitPulls: [], closedPulls: [] })).resolves.toEqual({
    release: 'false'
  })
})

test('does not resume a pending release that is not an ancestor of the pushed commit', async () => {
  const pr = releasePullRequest()
  for (const compareStatus of ['behind', 'diverged', 'identical']) {
    await expect(
      detect({ eventSha: laterSha, commitPulls: [], closedPulls: [pr], compareStatus })
    ).resolves.toEqual({ release: 'false' })
  }
})

test('does not resume pending labels outside a same-repository Release Please branch', async () => {
  const foreign = releasePullRequest({
    head: { ref: 'release-please--x', repo: { full_name: 'someone/fork' } }
  })
  const ordinary = releasePullRequest({ head: { ref: 'feature', repo: { full_name: repository } } })
  for (const pr of [foreign, ordinary]) {
    await expect(
      detect({ eventSha: laterSha, commitPulls: [], closedPulls: [pr] })
    ).resolves.toEqual({ release: 'false' })
  }
})

test('does not guess between several pending releases', async () => {
  await expect(
    detect({
      eventSha: laterSha,
      commitPulls: [],
      closedPulls: [releasePullRequest(), releasePullRequest({ number: 48 })]
    })
  ).resolves.toEqual({ release: 'false' })
})
