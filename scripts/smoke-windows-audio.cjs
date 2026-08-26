/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const binding = require('@streamdeck-deej/windows-audio-native')

assert.equal(typeof binding.snapshot, 'function')
assert.equal(typeof binding.setVolume, 'function')
assert.equal(typeof binding.setMuted, 'function')
assert.throws(
  () => binding.setVolume({ kind: 'master' }, -0.01),
  /volume must be a finite number from 0 to 1/
)
assert.throws(
  () => binding.setVolume({ kind: 'process', processId: 0 }, 0.5),
  /processId must be a positive integer/
)
assert.throws(
  () => binding.setMuted({ kind: 'master' }, 'yes'),
  /setMuted requires target and boolean/
)

console.log(
  `Loaded Windows audio addon with Electron ${process.versions.electron} and Node-API ${process.versions.napi}`
)
