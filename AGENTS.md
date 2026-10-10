# AGENTS.md

## Architecture and Trust Boundaries

- Keep Electron responsibilities separated: `src/main/` owns hardware, OS integrations, configuration, and application lifecycle; `src/preload/` exposes the narrow `window.api` bridge; `src/renderer/src/` owns the React UI and Zustand state; `src/shared/` holds pure code used by both sides.
- Linux is the primary target and Windows is also supported. Put OS-specific behavior behind the capabilities in `src/main/platform-runtime.ts` (Linux in `src/main/platform-linux.ts`, Windows audio in `packages/windows-audio-native/`) instead of branching on `process.platform` across services.
- Chromium picks its display backend before the main script runs. Startup switches such as the XWayland relaunch for NVIDIA on Wayland (`src/main/linux-display.ts`) must run at the top of `src/main/index.ts`, before any window, lock, or service is created; keep an explicit `--ozone-platform` and the dev server untouched.
- The renderer is sandboxed with context isolation and no Node.js integration. Add renderer/main communication through the preload API and register main-process listeners with the trusted IPC helpers, which restrict calls to the expected `WebContents` main frame.

## Settings Contract

- Treat `AppSettings` in `src/main/types/settings.types.ts` as the complete persisted schema. The separately maintained renderer schema in `src/renderer/src/types/settings.types.ts` is a redacted IPC view; keep their shared fields and validators synchronized.
- `settings:hydrate` returns `RendererSettings`, never stored tokens or client secrets. It exposes only configuration-state booleans for secrets. `settings:update` sends the full renderer settings plus explicit `unchanged`, `set`, or `clear` secret operations and is validated again in the main process.
- Configuration is stored in Electron's user-data `config.json` with mode `0600`. Secrets are encrypted with Electron `safeStorage` when a secure keyring backend is available and fall back to plain values in that file otherwise. Preserve that permission, the keyring encryption, and the rule that secrets remain in the main process when changing settings, IPC, or persistence.
- Use `src/preload/index.ts` and `src/main/handlers/` as the source of truth for IPC channels and directions; keep transport changes aligned on both sides.

## Validation

- Before committing, run `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:test`, and `pnpm test:coverage`, as CI does.
- Tests live in `tests/`. Linux-only tests are named `tests/linux-*.test.ts` so that `pnpm test:windows` can exclude them.
- Coverage is opt-in per file in `vitest.config.mts`: add new testable main-process modules to `coverage.include` with their thresholds, and keep pure logic injectable (as `xwaylandRelaunchArgs` takes its environment) so it can be tested without Electron.
- In VS Code terminals, `ELECTRON_RUN_AS_NODE=1` makes Electron behave as Node.js; the `dev` and `start` scripts already unset it, so launch the app through them.

## Git and Pull Request Policy

- Agents may create branches, commit changes, push branches, and open pull requests.
- Commit subjects and pull request titles must be written in English with a Conventional Commit prefix.
- Pull request descriptions must be written in French.
- Every pull request must be reviewed by the repository owner before it is merged.
- Only the repository owner may merge pull requests. Agents must never merge a pull request or enable auto-merge.
- Agents must not approve or close pull requests.
- After opening or updating a pull request, stop and wait for the repository owner's review.
- Never push directly to `main`.
