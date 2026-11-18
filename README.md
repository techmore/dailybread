# DailyBread Pilot

A single-page React app that presents an operating model for daily sourdough production. Its tabs are Project, Model, Automation, Cookies, Home Daily Bread, Phase 1, and Pan Bread, with cost and equipment tables and three.js scenes of the production flow.

**Live site:** https://techmore.github.io/dailybread/

## Run locally

Requires Node.js (the deploy workflow uses Node 22).

```sh
npm install
npm run dev      # development server
npm run build    # production build in dist/
npm run preview  # serve the build
```

Pushing to `main` runs `.github/workflows/pages.yml`, which builds the app and deploys `dist/` to GitHub Pages.

## Layout

| Path | What it is |
|---|---|
| `index.html` | Vite entry page |
| `src/main.jsx` | The whole app: models, calculations, pages, and 3D scenes |
| `src/styles.css` | Stylesheet |
| `public/` | Static files copied into the build |
| `vite.config.js` | Vite config, with the base path set to `/dailybread/` |
| `package.json` | Scripts and dependencies (Vite, React, three, lucide-react) |

Part of [Techmore](https://techmore.github.io/pages/repos/).
