/// <reference types="/vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    readonly VITE_DEV_SERVER_URL: string;
    DIST_ELECTRON: string;
    DIST: string;
    VITE_PUBLIC: string;
  }
}
