# Icons Studio

Local multi-page UI for browsing, visualizing, and editing every SVG icon in this repo.

## Quick start

From the repo root:

```bash
npm --prefix .github/scripts install   # first time only
npm --prefix .github/scripts run demo
```

Then open http://localhost:5173/ (redirects to `/browse`). Override the port with `PORT=8080`.

## Pages

Each tab is a real URL — deep-link, bookmark, or share.

### `/browse`

Grid view of every icon. Filter by category, search by name, recolor via the color picker (swaps `currentColor`), and resize with the slider. Click a tile to open the detail dialog with copyable SVG markup and an "Open in Studio" shortcut.

### `/studio` &nbsp;·&nbsp; `/studio?icon=<category>/<name>` for deep links

Vector editor for SVG icons.

- **Left panel** — searchable icon picker. Includes both registry icons and any `custom/*` icons you have created (persisted in `localStorage`).
- **Tools palette** (floating, top-left of canvas) — pick a tool then click+drag on the canvas to create a shape. Tools: Select, Rectangle, Ellipse, Line. After a shape is drawn the tool auto-switches back to Select.
- **Canvas** — the SVG is mounted live. Click any shape to select it. Drag to reposition. Background click (with Select tool) deselects.
- **Right panel — Element Tree** — flat list of every shape.
- **Right panel — Properties** — always shows the SVG root section (`title`, `width`, `height`, `viewBox`). When a shape is selected, sections for `fill`/`stroke`/`opacity`, `transform`, and per-element actions appear.

#### Toolbar

- `+ New Icon` — blank 48&times;48 SVG under a `custom` category, persisted to `localStorage`
- `Undo` / `Redo` — 100-step per-icon history
- `Reset` — restore the original SVG (clears history)
- `Center Selected` — clear the transform on the selected element
- `Zoom` — scale canvas rendering (source `viewBox` unchanged)
- `Copy SVG` / `Download` — export the edited SVG

#### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `V` | Select tool |
| `R` / `O` / `L` | Rectangle / Ellipse / Line tool |
| `Ctrl/Cmd + Z` | Undo |
| `Ctrl + Y` / `Ctrl + Shift + Z` | Redo |
| `Ctrl + C` / `Ctrl + V` | Copy / paste selected shape |
| `Ctrl + D` | Duplicate selected shape (offset by 10px) |
| `Delete` / `Backspace` | Remove selected shape |
| Arrow keys | Nudge selected shape 1px (Shift = 10px) |
| `Ctrl + ]` / `Ctrl + [` | Bring forward / send backward |
| `Ctrl + Shift + ]` / `Ctrl + Shift + [` | Bring to front / send to back |

Registry files are never modified. Use `Copy SVG` or `Download` to persist changes off-server.

### `/graph`

Read-only dashboard of registry-wide metrics:

- Total icons, categories, average shapes/icon, total & average SVG source size
- Icons per category (horizontal bar chart)
- Complexity distribution (bucketed by shape count)
- Size distribution (bucketed by SVG source bytes)
- Top 10 largest icons

## Project layout

```
.github/scripts/
├── demo-server.ts               # Static file server (paths + fallback to repo root)
├── demo/
│   ├── browse.html              # /browse
│   ├── studio.html              # /studio
│   ├── graph.html               # /graph
│   └── assets/
│       ├── css/
│       │   └── main.css         # Shared styles for all three pages
│       └── js/
│           ├── data.js          # Icon loading (index.json → *.json → SVGs)
│           ├── shell.js         # Nav active state, stats badge, toast
│           ├── browse.js        # /browse logic
│           ├── studio.js        # /studio editor (drag, undo/redo, props, new icon)
│           └── graph.js         # /graph metrics + charts
├── update-category.ts           # Regenerates <category>.json index files
├── package.json                 # Scripts: demo, update-category, build
└── README.md
```

## How the server routes requests

`demo-server.ts` handles four kinds of requests:

1. `/` — 302 redirect to `/browse`
2. `/browse`, `/studio`, `/graph` — served from `demo/*.html`
3. `/assets/**` — served from `demo/assets/**`
4. Anything else — served from the repo root (so `/index.json`, `/brands.json`, `/brands/react.json` etc. all work)

Path traversal is blocked by requiring the resolved path to stay inside the intended root.

## Notes

- No build step, no runtime dependencies. Everything is vanilla ES modules loaded directly by the browser.
- Custom icons are stored under the `kfe-custom-icons` `localStorage` key. Clear browser storage to reset.
