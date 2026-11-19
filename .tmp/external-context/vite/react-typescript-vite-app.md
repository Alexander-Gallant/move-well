---
source: Context7 API (official Vite documentation and repository)
library: Vite
package: vite
topic: React + TypeScript app scaffolding, npm scripts, and offline/static deployment
fetched: 2026-10-18T00:00:00Z
official_docs: https://vite.dev/guide/
---

# React + TypeScript with Vite

## Scaffold

```bash
npm create vite@latest my-app -- --template react-ts
cd my-app
npm install
```

`react-ts` is the official React + TypeScript template. With npm 7+, the extra `--` forwards the template argument to `create-vite`.

## Current scaffolded npm scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "oxlint",
    "preview": "vite preview"
  }
}
```

- `npm run dev` starts the development server.
- `npm run build` type-checks through the TypeScript project references build, then creates the production bundle.
- `npm run lint` runs the template's Oxlint configuration.
- `npm run preview` serves the production `dist` output locally; it is for local verification, not a production server.

## Static/offline deployment considerations

- `npm run build` writes deployable static files to `dist/`.
- For a nested public URL, set Vite's `base` to that path, including the trailing slash (for example, `base: '/my-app/'`). Vite rewrites imported assets, CSS URLs, and HTML asset references accordingly.
- For embedded/offline-style deployment where the final location is not known, Vite supports `base: './'` (or `base: ''`) so generated URLs are relative. Test the built files through a static HTTP server; browser `file://` behavior can differ from a hosted static site.
- GitHub Pages at `https://USER.github.io/REPO/` needs `base: '/REPO/'`; a user/custom-domain root site uses `/` (the default). GitHub Pages requires a build workflow.
- `vite preview` is useful for checking the built `dist` directory locally before copying it to the target static host.

## Official sources

- Scaffold: https://vite.dev/guide/
- Static deployment: https://vite.dev/guide/static-deploy.html
- Public base path: https://vite.dev/guide/build.html#public-base-path
- `base` option: https://vite.dev/config/shared-options.html#base
- React TypeScript template package: https://github.com/vitejs/vite/blob/main/packages/create-vite/template-react-ts/package.json
