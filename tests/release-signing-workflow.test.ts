import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const workflow = readFileSync('.github/workflows/release.yml', 'utf8')

test('release signing is approval-gated and receives only the expected environment secrets', () => {
  const signingJob = workflow.slice(
    workflow.indexOf('  sign-release-artifacts:'),
    workflow.indexOf('  attest-release:')
  )
  expect(signingJob).toContain('environment: release-signing')
  expect(signingJob).toContain(
    'UPDATE_SIGNING_PRIVATE_KEY: ${{ secrets.UPDATE_SIGNING_PRIVATE_KEY }}'
  )
  expect(signingJob).toContain(
    'UPDATE_SIGNING_KEY_PASSPHRASE: ${{ secrets.UPDATE_SIGNING_KEY_PASSPHRASE }}'
  )
  expect(signingJob).toContain('node scripts/update-signing.mjs sign')
  expect(workflow.indexOf('  sign-release-artifacts:')).toBeLessThan(
    workflow.indexOf('  create-release:')
  )
})

test('publishes and verifies the signed manifest and signature with the release artifacts', () => {
  const publishJob = workflow.slice(workflow.indexOf('  publish-release:'))
  expect(publishJob).toContain('node scripts/update-signing.mjs verify')
  expect(publishJob.match(/release-artifacts\/update-manifest-v1\.json/g)).toHaveLength(1)
  expect(publishJob.match(/release-artifacts\/update-manifest-v1\.sig/g)).toHaveLength(1)
})
