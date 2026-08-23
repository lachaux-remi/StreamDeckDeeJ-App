import { execFile } from 'node:child_process'

export interface CommandRunner {
  run(file: string, args: readonly string[], timeout: number): Promise<string>
}

export interface Command {
  file: string
  args: readonly string[]
  timeout: number
}

export const commandRunner: CommandRunner = {
  run(file, args, timeout) {
    return new Promise((resolve, reject) => {
      execFile(file, args, { encoding: 'utf-8', timeout }, (error, stdout) => {
        if (error) {
          reject(error)
          return
        }
        resolve(stdout)
      })
    })
  }
}

export async function runCommandWithFallback(
  runner: CommandRunner,
  primary: Command,
  fallback: Command
): Promise<string> {
  try {
    return await runner.run(primary.file, primary.args, primary.timeout)
  } catch {
    return runner.run(fallback.file, fallback.args, fallback.timeout)
  }
}

export class LatestValueExecutor<Key, Value> {
  private readonly pending = new Map<Key, Value>()
  private readonly activeKeys = new Set<Key>()
  private readonly idleListeners = new Set<() => void>()
  private readonly concurrency: number
  private readonly execute: (key: Key, value: Value) => Promise<void>
  private active = 0

  constructor(concurrency: number, execute: (key: Key, value: Value) => Promise<void>) {
    if (concurrency < 1) {
      throw new Error('Concurrency must be at least one')
    }
    this.concurrency = concurrency
    this.execute = execute
  }

  submit(key: Key, value: Value): void {
    this.pending.set(key, value)
    this.pump()
  }

  onIdle(): Promise<void> {
    if (this.active === 0 && this.pending.size === 0) {
      return Promise.resolve()
    }
    return new Promise((resolve) => this.idleListeners.add(resolve))
  }

  private pump(): void {
    while (this.active < this.concurrency && this.pending.size > 0) {
      const next = [...this.pending.entries()].find(([key]) => !this.activeKeys.has(key))
      if (!next) {
        return
      }

      this.pending.delete(next[0])
      this.activeKeys.add(next[0])
      this.active += 1

      void this.execute(next[0], next[1])
        .catch(() => undefined)
        .finally(() => {
          this.activeKeys.delete(next[0])
          this.active -= 1
          this.pump()
          if (this.active === 0 && this.pending.size === 0) {
            for (const resolve of this.idleListeners) {
              resolve()
            }
            this.idleListeners.clear()
          }
        })
    }
  }
}
