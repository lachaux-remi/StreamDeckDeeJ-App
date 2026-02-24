# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StreamDeck DeeJ is an Electron desktop app for Linux that controls Stream Deck hardware buttons and DeeJ audio sliders via Arduino serial communication. It also integrates with Home Assistant for smart home control.

## Tech Stack

- **Runtime**: Electron 33 + Node.js 24 + TypeScript 5.9
- **Build**: electron-vite 5, Vite 6, electron-builder 25
- **Frontend**: React 19, Zustand (state), Tailwind CSS 4, shadcn/ui (new-york style)
- **Backend**: serialport (Arduino serial), electron-store (config persistence), pino (logging)
- **Package manager**: pnpm

## Commands

```bash
pnpm dev            # Start dev server with HMR
pnpm build          # Typecheck + production build
pnpm build:linux    # Build + package for Linux (AppImage/pacman)
pnpm lint           # ESLint
pnpm lint:fix       # ESLint autofix
pnpm format         # Prettier
pnpm typecheck      # TypeScript check (node + web)
```

## Architecture

### Three-process Electron architecture (electron-vite)

- **Main** (`src/main/`): Node.js backend - services, IPC handlers, window/tray management
- **Preload** (`src/preload/`): Secure bridge via `contextBridge` exposing `window.api`
- **Renderer** (`src/renderer/src/`): React SPA - single-page dashboard (no router)

### Main process (`src/main/`)

Services are singletons exported from their files:

- `services/config.service.ts` - electron-store wrapper, emits `config:updated`
- `services/serial.service.ts` - SerialPort + ReadlineParser, auto-reconnect, emits `serial:deck` / `serial:deej`
- `services/deck.service.ts` - Maps button presses to module actions (HA, IR, Macro)
- `services/slider.service.ts` - ADC→0-1 conversion, threshold filtering
- `services/sessions.service.ts` - Linux audio sessions via `pactl` commands
- `services/logger.service.ts` - Log accumulation + event emission

IPC handlers in `handlers/` follow one-file-per-domain pattern, registered via `registerAllHandlers()`.

### Renderer (`src/renderer/src/`)

Single-page dashboard layout - no router. All views visible at once:

- **Header**: app name, serial connection LED, settings gear
- **StreamDeck grid**: configurable NxM grid (click button → config dialog)
- **DeeJ sliders**: configurable count (click label → session assignment dialog)
- **Console**: collapsible bottom panel with colored log entries
- **Settings**: slide-over sheet from right

State management: two Zustand stores (`settings.store.ts` for config, `serial.store.ts` for runtime data). Config syncs to main process via `window.api.settings.update()`.

### IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `settings:hydrate` | renderer→main | Load full config |
| `settings:update` | renderer→main | Save config changes |
| `serial:list` | renderer→main | List serial ports |
| `serial:status` | main→renderer | Connection status updates |
| `deej:slider` | main→renderer | Real-time slider values |
| `streamdeck:update` | main→renderer | Button state changes |
| `electron:log` | main→renderer | Log entries |

### Config Schema (`electron-store`)

Key settings: `comPort`, `baudRate`, `gridCols`, `gridRows`, `sliderCount`, `streamdeck` (button configs), `deej` (slider→session mappings), `homeAssistant.url`.

## Path Aliases

- `@main/*` → `src/main/*` (in main/preload tsconfig)
- `@renderer/*` → `src/renderer/src/*` (in renderer tsconfig)

## Linux-specific Notes

- Serial ports: `/dev/ttyACM0`, `/dev/ttyUSB0` (user needs `uucp` group on Arch/CachyOS)
- Audio control: uses `pactl` (PipeWire PulseAudio compat) for per-app volume
- Build targets: AppImage + pacman (.pkg.tar.zst)
