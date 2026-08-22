import { expect, test } from 'vitest'
import {
  type Command,
  type CommandRunner,
  LatestValueExecutor,
  commandRunner,
  runCommandWithFallback
} from './audio-command'

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

const deferred = (): Deferred => {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

test('runs commands without blocking the event loop', async () => {
  let commandCompleted = false
  const command = commandRunner.run(
    process.execPath,
    ['-e', 'setTimeout(() => process.stdout.write("done"), 50)'],
    1_000
  )
  void command.then(() => {
    commandCompleted = true
  })

  await new Promise((resolve) => setImmediate(resolve))

  expect(commandCompleted).toBe(false)
  expect(await command).toBe('done')
})

test('runs the fallback only after the primary command fails', async () => {
  const calls: Command[] = []
  const fakeRunner: CommandRunner = {
    async run(file, args, timeout): Promise<string> {
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

  expect(output).toBe('Volume: 42%')
  expect(calls.map(({ file }) => file)).toEqual(['wpctl', 'pactl'])
})

test('bounds concurrency and applies only the latest pending value per target', async () => {
  const first = deferred()
  const applied: Array<[string, number]> = []
  let active = 0
  let maxActive = 0
  const executor = new LatestValueExecutor<string, number>(4, async (target, value) => {
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
  expect(applied).toEqual([['master', 0.1]])

  first.resolve()
  await executor.onIdle()

  expect(applied).toEqual([
    ['master', 0.1],
    ['master', 0.9]
  ])
  expect(maxActive).toBe(1)
})

test('allows bounded parallelism across independent targets', async () => {
  const gates = [deferred(), deferred()]
  let active = 0
  let maxActive = 0
  const executor = new LatestValueExecutor<string, number>(2, async (_target, index) => {
    active += 1
    maxActive = Math.max(maxActive, active)
    await gates[index].promise
    active -= 1
  })

  executor.submit('one', 0)
  executor.submit('two', 1)
  executor.submit('three', 1)
  await new Promise((resolve) => setImmediate(resolve))

  expect(maxActive).toBe(2)
  gates[0].resolve()
  gates[1].resolve()
  await executor.onIdle()
})
