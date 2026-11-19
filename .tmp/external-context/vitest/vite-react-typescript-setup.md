---
source: Context7 API + official Vitest docs
library: Vitest
package: vitest
topic: Vite + React + TypeScript setup, DOM/localStorage testing
tech_stack: Vite + React + TypeScript
fetched: 2026-10-18T00:00:00Z
official_docs: https://vitest.dev/guide/
---

# Vitest with Vite + React + TypeScript

The current official site documents Vitest **v5.0.5**. It requires Vite >= 6.4.0 and Node >= 22.12.0.

## Installation and script

```bash
npm install -D vitest
```

Add a package script:

```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

Use `npm run test` for watch mode or `npx vitest run` for a one-time run. Test files conventionally use `.test.` or `.spec.` in their names.

## Configuration

Vitest reads `vite.config.ts` by default, so existing Vite plugins/configuration are reused. Use a dedicated `vitest.config.ts` when test settings should be separate; it takes priority over `vite.config.ts`.

For a dedicated config:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
```

If React's Vite plugin is not already loaded by the Vite config, include `@vitejs/plugin-react` in the config's `plugins` array. If a separate config must retain the app's Vite settings, use Vitest's `mergeConfig` with the existing Vite config.

## TypeScript setup

Prefer explicit imports in tests:

```ts
import { expect, test } from 'vitest'
```

If using global `test`, `expect`, etc., enable them and add the types:

```ts
// vitest.config.ts
test: { globals: true }
```

```json
{
  "compilerOptions": {
    "types": ["vitest/globals"]
  }
}
```

Merge this with any existing `types` entries rather than replacing required app types.

## DOM and localStorage tests

Vitest defaults to the `node` environment. For React/component tests or code using `window`, `document`, and `localStorage`, install and select a DOM environment:

```bash
npm install -D jsdom
```

```ts
test: {
  environment: 'jsdom',
}
```

`happy-dom` is the faster alternative, but the official guide notes that it has less API coverage than `jsdom`:

```bash
npm install -D happy-dom
```

Use `// @vitest-environment jsdom` at the top of an individual test file when only that file needs browser APIs. DOM environments provide browser-like globals, including `localStorage`; keep storage isolated by clearing it in setup/teardown when tests share state. For TypeScript's jsdom environment types, add `"vitest/jsdom"` to `compilerOptions.types` if needed.

## Real browser mode

`environment: 'jsdom'` is a Node-run DOM simulation, not a real browser. For native browser execution, install a provider and enable Browser Mode:

```bash
npm install -D @vitest/browser-playwright
```

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  plugins: [react()],
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
```

Use Browser Mode when browser-native behavior is the subject of the test; use `jsdom`/`happy-dom` for fast unit and component tests.

## Sources

- https://vitest.dev/guide/
- https://vitest.dev/config/
- https://vitest.dev/guide/environment
- https://vitest.dev/guide/browser/
- Context7 library: https://context7.com/vitest-dev/vitest
