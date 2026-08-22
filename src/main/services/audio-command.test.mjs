import assert from 'node:assert/strict'
import test from 'node:test'
import { LatestValueExecutor, commandRunner, runCommandWithFallback } from './audio-command.ts'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

test('runs commands without blocking the event loop', async () => {
  let commandCompleted = false
  const command = commandRunner.run(
    process.execPath,
    ['-e', 'setTimeout(() => process.stdout.write("done"), 50)'],
    1_000
  )
  void command.then(() => (commandCompleted = true))

  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(commandCompleted, false)
  assert.equal(await command, 'done')
})

test('runs the fallback only after the primary command fails', async () => {
  const calls = []
  const fakeRunner = {
    async run(file, args, timeout) {
      calls.push({ file, args, timeout })
      if (file === 'wpctl') throw new Error('unavailable')
      return 'Volume: 42%'
    }
  }

  const output = await runCommandWithFallback(
    fakeRunner,
    { file: 'wpctl', args: ['get-volume', '@DEFAULT_AUDIO_SINK@'], timeout: 2_000 },
    { file: 'pactl', args: ['get-sink-volume', '@DEFAULT_SINK@'], timeout: 2_000 }
  )

  assert.equal(output, 'Volume: 42%')
  assert.deepEqual(
    calls.map(({ file }) => file),
    ['wpctl', 'pactl']
  )
})

test('bounds concurrency and applies only the latest pending value per target', async () => {
  const first = deferred()
  const applied = []
  let active = 0
  let maxActive = 0
  const executor = new LatestValueExecutor(4, async (target, value) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    applied.push([target, value])
    if (applied.length === 1) await first.promise
    active -= 1
  })

  executor.submit('master', 0.1)
  executor.submit('master', 0.2)
  executor.submit('master', 0.9)

  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(applied, [['master', 0.1]])

  first.resolve()
  await executor.onIdle()

  assert.deepEqual(applied, [
    ['master', 0.1],
    ['master', 0.9]
  ])
  assert.equal(maxActive, 1)
})

test('allows bounded parallelism across independent targets', async () => {
  const gates = [deferred(), deferred()]
  let active = 0
  let maxActive = 0
  const executor = new LatestValueExecutor(2, async (_target, index) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await gates[index].promise
    active -= 1
  })

  executor.submit('one', 0)
  executor.submit('two', 1)
  executor.submit('three', 1)
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(maxActive, 2)
  gates[0].resolve()
  gates[1].resolve()
  await executor.onIdle()
})
