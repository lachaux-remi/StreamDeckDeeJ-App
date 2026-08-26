import type { UpdateCommand } from '../types/update.types'

export type UpdateConsent = 'download' | 'install'

export interface UpdateActions {
  check(): Promise<void>
  download(): Promise<void>
  install(): Promise<void>
  openRelease(): Promise<void>
}

export function createSerialCommandExecutor(): (task: () => Promise<void>) => Promise<void> {
  let queue = Promise.resolve()
  return (task) => {
    const execution = queue.then(task)
    queue = execution.catch(() => {})
    return execution
  }
}

export async function executeUpdateCommand(
  command: UpdateCommand,
  actions: UpdateActions,
  confirm: (consent: UpdateConsent) => Promise<boolean>
): Promise<void> {
  if (command === 'check') {
    return actions.check()
  }
  if (command === 'open-release') {
    return actions.openRelease()
  }
  if (!(await confirm(command))) {
    return
  }
  if (command === 'download') {
    return actions.download()
  }
  await actions.install()
}
