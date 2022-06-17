import { join } from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import pkg from "../../package.json"

// https://vitejs.dev/config/
export default defineConfig( {
    root: __dirname,
    mode: process.env.NODE_ENV,
    base: "./",
    build: {
        outDir: "../../dist/renderer",
        emptyOutDir: true,
        sourcemap: true
    },
    server: {
        host: pkg.env.VITE_DEV_SERVER_HOST,
        port: pkg.env.VITE_DEV_SERVER_PORT
    },
    resolve: {
        alias: {
            "@": join( __dirname, "src" )
        }
    },
    plugins: [ react() ]
} )
