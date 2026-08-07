# Slaide

Slaide is a local-first presentation editor. You create decks, draw on fixed-size slides, and present your work in the browser. No account and no server are required.

## What Slaide does

You organize slides in a **deck**. Each slide is a 1920 by 1080 surface. You draw on a slide with Excalidraw tools. You can reorder, duplicate, swap, and delete slides. You can preview one slide in the sidebar. You can present the full deck in presentation mode.

Slaide stores all deck data in your browser. Your content stays on your device.

## Main features

- **Local storage** — Decks and slides live in IndexedDB in the browser.
- **Drawing** — Each slide uses one Excalidraw scene.
- **Presentation mode** — View slides as static images. Use fullscreen when the browser allows it.
- **Export** — Download a deck as a `.slaide` backup file or as a `.pdf` document.
- **Import** — Restore a deck from a `.slaide` file on the home screen.
- **Offline use** — After the first load, the app shell works without a network. You can install Slaide as a PWA.
- **Themes** — Switch between light and dark mode.

## File formats

| Format | Purpose |
| --- | --- |
| `.slaide` | Versioned JSON backup of one complete deck. Use this to move or restore your work. |
| `.pdf` | One deck as a document. Each slide is one borderless 16:9 page. |

## Requirements

- A modern browser with IndexedDB support
- Node.js 20 or later (for development and build only)
- pnpm 9 or later (for development and build only)

## Development

Install dependencies:

```bash
pnpm install
```

Start the dev server:

```bash
pnpm dev
```

Open the URL shown in the terminal. The default is `http://localhost:5173`.

## Build

Create a production build:

```bash
pnpm build
```

Preview the build locally:

```bash
pnpm preview
```

## Deploy on Vercel

This project includes a `vercel.json` file for a static Vite build.

1. Connect the repository to Vercel.
2. Set the install command to `pnpm install`.
3. Set the build command to `pnpm build`.
4. Set the output directory to `dist`.

Vercel serves static files from `dist` and rewrites other routes to `index.html` for client-side routing.

## Test

Run unit and browser tests:

```bash
pnpm test
```

Run type checking:

```bash
pnpm typecheck
```

Run end-to-end tests (requires a prior build):

```bash
pnpm test:e2e
```

## Project layout

| Path | Description |
| --- | --- |
| `src/ui/` | Home screen, editor, and presentation pages |
| `src/storage/` | IndexedDB deck repository |
| `src/slaide-file/` | `.slaide` import and export |
| `src/pdf/` | PDF deck export |
| `src/presentation/` | Presentation image rendering |
| `docs/adr/` | Architecture decision records |
| `CONTEXT.md` | Domain glossary and workflows |

## Privacy

Slaide does not send your deck content to a remote service. Export and import use files you choose on your device.

## License

Private project. All rights reserved.
