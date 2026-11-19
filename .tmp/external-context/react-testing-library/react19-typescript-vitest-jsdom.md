---
source: Context7 API and official documentation
library: React Testing Library
package: @testing-library/react
topic: React 19 + TypeScript + Vitest + jsdom setup, user-event, and assertions
fetched: 2026-10-18T00:00:00Z
official_docs: https://testing-library.com/docs/react-testing-library/intro/
---

# React Testing Library with React 19, TypeScript, Vitest, and jsdom

## Install

```bash
npm install --save-dev \
  @testing-library/react @testing-library/dom \
  @testing-library/user-event @testing-library/jest-dom \
  vitest jsdom @types/react @types/react-dom
```

RTL 16+ requires `@testing-library/dom`. React 19 is supported by the current RTL implementation, which prefers the native `React.act` API. `jsdom` is required when Vitest tests need a browser-like DOM.

## Vitest configuration and setup file

Use the jsdom environment and load a TypeScript setup file before each test file:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

```ts
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => cleanup())
```

The explicit cleanup hook works without enabling Vitest globals. If using globals, add `vitest/globals` to TypeScript types. Include `vitest.setup.ts` in `tsconfig.json`; include `@testing-library/jest-dom` in `compilerOptions.types` when needed for matcher types.

## user-event

Prefer `userEvent.setup()` per test, before rendering, and await its interactions:

```ts
const user = userEvent.setup()
render(<Component />)
await user.click(screen.getByRole('button', { name: /save/i }))
```

`user-event` models complete browser interactions and performs interactability checks; use `fireEvent` only when a low-level event is specifically required. Direct APIs such as `userEvent.click()` remain supported, but instance methods are recommended.

## Queries and common assertions

- Prefer `screen.getByRole('button', { name: /save/i })`; use `getByLabelText` for form controls, then text/alt/title queries as appropriate. Use `getByTestId` as an escape hatch.
- `getBy...` throws when missing; `queryBy...` returns `null` and is appropriate for absence assertions; `findBy...` returns a promise and retries for async appearance.
- Typical jest-dom assertions: `toBeInTheDocument`, `toBeVisible`, `toBeDisabled`, `toBeChecked`, `toHaveAccessibleName`, `toHaveTextContent`, `toHaveValue`, `toHaveDisplayValue`, `toHaveAttribute`, `toHaveClass`, `toHaveStyle`, and `toHaveFormValues`.
- Use `queryBy...` with `.not.toBeInTheDocument()` when the element may be absent; do not use a `getBy...` query that throws before the assertion.

## Official sources

- React Testing Library installation and TypeScript: https://testing-library.com/docs/react-testing-library/intro/
- RTL setup, Vitest cleanup, and jsdom: https://testing-library.com/docs/react-testing-library/setup/
- Query priority and query semantics: https://testing-library.com/docs/queries/about/
- user-event guidance: https://testing-library.com/docs/user-event/intro/ and https://testing-library.com/docs/user-event/setup/
- jest-dom with Vitest and TypeScript: https://github.com/testing-library/jest-dom#with-vitest
- Vitest `environment`: https://vitest.dev/config/environment
- Vitest `setupFiles`: https://vitest.dev/config/setupfiles
