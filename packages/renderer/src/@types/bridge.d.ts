import { api } from "../../../preload/bridge"

export {}

declare global {
    interface Window {
        api: typeof api
    }
}
