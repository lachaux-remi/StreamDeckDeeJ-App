import react from "@vitejs/plugin-react";
import { rmSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";

import pkg from "./package.json";

export default defineConfig(({ command }) => {
  rmSync("dist-electron", { recursive: true, force: true });

  const isServe = command === "serve";
  const isBuild = command === "build";

  return {
    resolve: {
      alias: {
        "@": path.join(__dirname, "src")
      }
    },
    plugins: [
      react(),
      electron([
        {
          entry: "electron/main/index.ts",
          onstart(options) {
            options.startup();
          },
          vite: {
            build: {
              sourcemap: isServe,
              minify: isBuild,
              outDir: "dist-electron/main",
              rollupOptions: {
                external: Object.keys("dependencies" in pkg ? pkg.dependencies : {})
              }
            }
          }
        },
        {
          entry: "electron/preload/index.ts",
          onstart(options) {
            options.reload();
          },
          vite: {
            build: {
              sourcemap: isServe ? "inline" : undefined,
              minify: isBuild,
              outDir: "dist-electron/preload",
              rollupOptions: {
                external: Object.keys("dependencies" in pkg ? pkg.dependencies : {})
              }
            }
          }
        }
      ]),
      renderer()
    ],
    clearScreen: false
  };
});
