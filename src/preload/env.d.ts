import type { StreamDeckDeeJAPI } from './index'

declare global {
  interface Window {
    api: StreamDeckDeeJAPI
  }
}
