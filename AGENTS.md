# AGENTS.md

## Architecture and Trust Boundaries

- Keep Electron responsibilities separated: `src/main/` owns hardware, Linux integrations, configuration, and application lifecycle; `src/preload/` exposes the narrow `window.api` bridge; `src/renderer/src/` owns the React UI and Zustand state.
- The renderer is sandboxed with context isolation and no Node.js integration. Add renderer/main communication through the preload API and register main-process listeners with the trusted IPC helpers, which restrict calls to the expected `WebContents` main frame.

## Settings Contract

- Treat `AppSettings` in `src/main/types/settings.types.ts` as the complete persisted schema. The separately maintained renderer schema in `src/renderer/src/types/settings.types.ts` is a redacted IPC view; keep their shared fields and validators synchronized.
- `settings:hydrate` returns `RendererSettings`, never stored tokens or client secrets. It exposes only configuration-state booleans for secrets. `settings:update` sends the full renderer settings plus explicit `unchanged`, `set`, or `clear` secret operations and is validated again in the main process.
- Configuration is stored in Electron's user-data `config.json` with mode `0600`. Preserve that permission and the rule that secrets remain in the main process when changing settings, IPC, or persistence.
- Use `src/preload/index.ts` and `src/main/handlers/` as the source of truth for IPC channels and directions; keep transport changes aligned on both sides.

## Git and Pull Request Policy

- Agents may create branches, commit changes, push branches, and open pull requests.
- Commit subjects and pull request titles must be written in English with a Conventional Commit prefix.
- Pull request descriptions must be written in French.
- Every pull request must be reviewed by the repository owner before it is merged.
- Only the repository owner may merge pull requests. Agents must never merge a pull request or enable auto-merge.
- Agents must not approve or close pull requests.
- After opening or updating a pull request, stop and wait for the repository owner's review.
- Never push directly to `main`.
