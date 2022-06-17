import { join } from "path"
import { builtinModules } from "module"
import { defineConfig } from "vite"
import pkg from "../../package.json"

export default defineConfig( {
    root: __dirname,
    build: {
        outDir: "../../dist/preload",
        emptyOutDir: true,
        minify: process.env.NODE_ENV === "production",
        sourcemap: "inline",
        rollupOptions: {
            input: {
                bridge: join( __dirname, "bridge.ts" )
            },
            output: {
                format: "cjs",
                entryFileNames: "[name].cjs",
                manualChunks: {}
            },
            external: [
                "electron",
                ...builtinModules,
                ...Object.keys( pkg.dependencies || {} )
            ]
        }
    }
} )
