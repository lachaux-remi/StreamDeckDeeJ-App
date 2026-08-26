# Windows audio native module

App-owned Node-API binding for the Windows Core Audio surface used by StreamDeck DeeJ. It supports
the default multimedia render endpoint, process-session discovery, and volume/mute writes to the
master endpoint or every session belonging to a process ID.

The module is Windows x64 only. From the repository root, build it against Electron's headers with:

```powershell
pnpm build:windows-audio
```

The binding validates inputs before opening Core Audio, so `scripts/smoke-windows-audio.cjs` can
load the Electron-targeted module and exercise its error contract on a hardware-free Windows runner
without changing system volume. Actual endpoint discovery and writes still require a Windows audio
VM test.
