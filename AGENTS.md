# AGENTS.md

## Architecture and Trust Boundaries

- Keep Electron responsibilities separated: `src/main/` owns hardware, OS integrations, configuration, and application lifecycle; `src/preload/` exposes the narrow `window.api` bridge; `src/renderer/src/` owns the React UI and Zustand state; `src/shared/` holds pure code used by both sides.
- Linux is the primary target and Windows is also supported. Put OS-specific behavior behind the capabilities in `src/main/platform-runtime.ts` (Linux in `src/main/platform-linux.ts`, Windows audio in `packages/windows-audio-native/`) instead of branching on `process.platform` across services.
- Chromium picks its display backend before the main script runs. Startup switches such as the XWayland relaunch for NVIDIA on Wayland (`src/main/linux-display.ts`) must run at the top of `src/main/index.ts`, before any window, lock, or service is created; keep an explicit `--ozone-platform` and the dev server untouched.
- The renderer is sandboxed with context isolation and no Node.js integration. Add renderer/main communication through the preload API and register main-process listeners with `handleIpc` and `onIpc` from `src/main/handlers/trusted-ipc.ts`, which restrict calls to the expected `WebContents` main frame.
- Packaged builds load the renderer from the privileged `streamdeck-deej://renderer/` scheme (`src/main/renderer-protocol.ts`), which only serves `GET`/`HEAD` requests inside the renderer root. Do not switch to `file://` or widen what the protocol serves.

## Settings Contract

- Treat `AppSettings` in `src/main/types/settings.types.ts` as the complete persisted schema. The separately maintained renderer schema in `src/renderer/src/types/settings.types.ts` is a redacted IPC view; keep their shared fields and validators synchronized.
- `settings:hydrate` returns `RendererSettings`, never stored tokens or client secrets. It exposes only configuration-state booleans for secrets. `settings:update` sends the full renderer settings plus explicit `unchanged`, `set`, or `clear` secret operations and is validated again in the main process.
- Configuration is stored in Electron's user-data `config.json` with mode `0600`. Secrets are encrypted with Electron `safeStorage` when a secure keyring backend is available and fall back to plain values in that file otherwise. Preserve that permission, the keyring encryption, and the rule that secrets remain in the main process when changing settings, IPC, or persistence.
- Use `src/preload/index.ts` and `src/main/handlers/` as the source of truth for IPC channels and directions; keep transport changes aligned on both sides.
- Keep settings readable by older releases. When a config fails validation, `dropUnsupportedEntries` drops only unknown button modules, LED condition types, and LED modes, keeps the rest, and copies the original to `config.json.bak` (mode `0600`) before the next save. Any other invalid content, including an unknown top-level key, still falls back to defaults without touching the file, so extend existing structures with new enum values rather than adding top-level keys.
- A DeeJ slider maps to audio session names or to one `ha:<entity_id>` Home Assistant target (`src/shared/deej-targets.ts`). Audio code must read slider mappings through `audioSessionTargets` so it never treats those entries as sessions.

## Integrations

- Home Assistant calls stay in the main process: state comes from the WebSocket `subscribe_entities` stream with REST polling as fallback, and slider-driven calls are rate limited per entity and never sent for the position read at startup.
- Discord uses the local RPC socket with OAuth scopes requested in `discordService.authorize`. Discord rejects `AUTHORIZE` on an authenticated connection, so a token missing a newly required scope is upgraded once per run on a fresh connection, keeping the current token if consent is refused. Adding a scope therefore prompts every existing user once in Discord; say so in the pull request.

## Validation

- Before committing, run the checks CI runs: `pnpm typecheck:test`, `pnpm test:coverage`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and `pnpm audit --audit-level low`. CI also checks formatting with Prettier on workflows, packaging files, scripts, and tests, and runs `bash -n scripts/*.sh`.
- Tests live in `tests/`. Linux-only tests are named `tests/linux-*.test.ts` so that `pnpm test:windows` can exclude them.
- Coverage is opt-in per file in `vitest.config.mts`: add new testable main-process modules to `coverage.include` with their thresholds, and keep pure logic injectable (as `xwaylandRelaunchArgs` takes its environment) so it can be tested without Electron.
- Windows packaging (`pnpm package:windows`) and its native modules (`node-hid`, `serialport`, `packages/windows-audio-native/`) can only be validated on Windows; a cross-build from Linux proves nothing about them. Say so when a change touches Windows behavior.
- In VS Code terminals, `ELECTRON_RUN_AS_NODE=1` makes Electron behave as Node.js; the `dev` and `start` scripts already unset it, so launch the app through them.

## Dependencies

- Use pnpm with the version pinned in `package.json` `packageManager`, and install with `pnpm install --frozen-lockfile`. Packages allowed to run install scripts are listed in `allowBuilds` in `pnpm-workspace.yaml`; add a package there only when it needs a native build.
- Never silence an advisory in `pnpm audit` (`ignoreGhsas`, `ignoreCves`). Fix it with an update or an override documented in `pnpm-workspace.yaml`, as `tests/dependency-policy.test.ts` enforces.
- Electron is pinned to an exact version. When it changes, update the `--target` of `build:electron` in `packages/windows-audio-native/package.json` to the same version (`tests/electron-version-pin.test.ts`). Electron majors need a manual tray check under KDE Wayland.

## Releases and Update Signing

- Releases are produced by Release Please from Conventional Commits merged into `main`; `feat`, `fix`, `perf`, and `revert` appear in the French changelog. Do not edit `CHANGELOG.md`, versions, or the generated block of a release pull request by hand.
- Updates are verified against the Ed25519 manifest signature. Never add private keys, passphrases, or tokens to the repository, logs, or Actions artifacts. Rotating the update key takes two releases: first trust both keys in `TRUSTED_UPDATE_KEYS` (`src/main/services/signed-update.ts`), then switch `UPDATE_PUBLIC_KEY` and `UPDATE_KEY_ID` in `scripts/update-signing.mjs`.
- The pacman repository GPG key (`packaging/pacman/`) is separate from the update signing key.

## Git and Pull Request Policy

- Agents may create branches, commit changes, push branches, and open pull requests.
- Commit subjects and pull request titles must be written in English with a Conventional Commit prefix.
- Pull request descriptions must be written in French.
- Every pull request must be reviewed by the repository owner before it is merged.
- Only the repository owner may merge pull requests. Agents must never merge a pull request or enable auto-merge.
- Agents must not approve or close pull requests.
- After opening or updating a pull request, stop and wait for the repository owner's review.
- Never push directly to `main`.
