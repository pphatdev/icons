# KFe Icons — Desktop

Electron + Next.js (App Router, shadcn/ui) desktop app for browsing and
designing icons against this repo. Reads the registry directly from repo root
(`index.json` → `<category>.json` → `<category>/<name>.json`) via a Node IPC
bridge, and writes edits back to the same files — no HTTP server, no
Copy-SVG dance.

## Requirements

- Node.js 20+
- npm

## Run in development

From the repo root:

```
cd .github/scripts/desktop
npm run setup      # one-shot: installs root + renderer deps
npm run dev        # concurrently: next dev on :3000 + electron
```

`concurrently` starts `next dev` for the renderer and waits until port 3000
is up before booting Electron with `ELECTRON_RENDERER_URL=http://localhost:3000`.
Renderer edits hot-reload via Next.js HMR; main/preload edits recompile via
`tsc` on the next dev boot.

## Build

```
npm run build          # main + preload → out/, renderer → renderer/out/
npm run start          # production Electron loading renderer/out/index.html
npm run gen:favicon    # regenerate app/favicon.ico + apple-icon + public/icon.png
npm run build:legacy-css   # recompile the vanilla studio's Tailwind CSS
```

Packaging into installers (`electron-builder` / `electron-forge`) is out of
scope for now — dev + local-preview usage only.

## Project layout

```
.github/scripts/desktop/
├── package.json                  # concurrently + wait-on + cross-env + electron
├── main/                         # Electron main (compiled to out/main/)
│   ├── index.ts                  # BrowserWindow + lifecycle + AppUserModelId
│   ├── ipc.ts                    # kfe:* handlers
│   ├── registry.ts               # repo-root discovery + safe FS access
│   └── tsconfig.json
├── preload/
│   ├── index.ts                  # contextBridge → window.kfe
│   └── tsconfig.json
├── renderer/                     # Next.js 15 App Router (React 19 + shadcn/ui)
│   ├── next.config.mjs           # output: 'export' for production Electron
│   ├── app/
│   │   ├── layout.tsx            # RootLayout + TopBar + AppRail
│   │   ├── page.tsx              # Browse
│   │   ├── globals.css           # shadcn OKLCH tokens + component classes
│   │   ├── favicon.ico           # multi-res, generated from icon.svg
│   │   ├── icon.svg              # source of truth (KFe Meetup mark)
│   │   └── apple-icon.png        # 180×180
│   ├── components/
│   │   ├── ui/{button,dialog,input,select,slider,toggle-group,tooltip}.tsx
│   │   ├── brand-logo.tsx
│   │   ├── app-rail.tsx
│   │   ├── top-bar.tsx
│   │   └── browse/{browse-view,icon-detail-dialog}.tsx
│   ├── lib/{utils,kfe}.ts
│   ├── public/
│   │   ├── icon.png              # 512×512 for BrowserWindow.icon
│   │   └── legacy/               # vanilla Studio (HTML + JS + compiled CSS)
│   └── scripts/gen-favicon.mjs
├── legacy/                       # original vanilla source (pre-Nextron)
└── out/                          # build output (gitignored)
```

## IPC surface (`window.kfe`)

| Method | Returns | Notes |
| --- | --- | --- |
| `getRepoRoot()` | `string` | Absolute path the app reads/writes against |
| `loadRegistry()` | `{ categories, icons }` | One-shot walk of the registry |
| `saveIcon({ category, name, content })` | `string` | Writes `<repo>/<category>/<name>.json`. Slug-validated + path-traversal guarded |

The Studio (vanilla page under `renderer/public/legacy/`) uses the same bridge
because it loads via full-page navigation to `/legacy/studio.html` — Electron
preloads don't cross iframe boundaries, so we avoid iframing.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`
  (required for preload IPC).
- Preload exposes only the three methods above.
- `safeRepoPath` in `registry.ts` refuses any resolved path that escapes the
  detected repo root.
