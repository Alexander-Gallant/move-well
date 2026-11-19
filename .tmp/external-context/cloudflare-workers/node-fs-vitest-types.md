---
source: Cloudflare official documentation + Context7
library: Cloudflare Workers
package: cloudflare-workers
topic: node-fs-vitest-types
fetched: 2026-11-19T00:00:00Z
official_docs: https://developers.cloudflare.com/workers/languages/typescript/
---

# `node:fs` in TypeScript Worker tests using Vitest

## TypeScript recommendation

Cloudflare's current TypeScript guidance says to generate runtime/binding types with `wrangler types`. If the Worker uses the `nodejs_compat` compatibility flag, Cloudflare also says to install `@types/node` and include `"node"` in the relevant `tsconfig.json` `compilerOptions.types`, alongside the generated Worker configuration types:

```jsonc
{
  "compilerOptions": {
    "types": ["./worker-configuration.d.ts", "node"]
  }
}
```

For Vitest tests specifically, the Workers guide recommends a test-folder `tsconfig.json` containing `"@cloudflare/vitest-plugin/types"` and the generated `worker-configuration.d.ts`. If the test file imports `node:fs`, add `@types/node` to the package's devDependencies and add `"node"` to that test tsconfig's `types` list (or to a shared tsconfig used by the tests). Do not replace the Cloudflare/Vitest types with Node types.

## Runtime caveat

The Workers Vitest plugin runs test files in `workerd`, while the Vitest config and `globalSetup` run in Node.js. The plugin automatically enables a minimal `nodejs_compat` setup for tests, but Cloudflare warns that this can make tests pass when deployment does not have the corresponding compatibility configuration.

`node:fs` is supported in Workers with Node.js compatibility. It is a virtual, in-memory filesystem: bundled files are read-only under `/bundle`, and temporary files can be written under `/tmp`. It is not the host machine's filesystem.

## Fix recommendation

1. Keep the import if the test is intentionally exercising Worker-supported `node:fs` behavior.
2. Add `@types/node` as a **devDependency** and include `"node"` in the **test tsconfig** types, together with `@cloudflare/vitest-plugin/types` and generated Worker types.
3. Ensure the deployed Worker's compatibility date/flags support `node:fs` (for earlier dates, configure `nodejs_compat` and the required fs-module flag; newer dates may enable compatibility by default).
4. If the test only needs host filesystem access for setup/fixtures, move that code to Vitest `globalSetup` or config-side Node code rather than importing `node:fs` in a Worker-runtime test; alternatively use fixture/binding setup supported by the Workers Vitest plugin.

## Sources

- TypeScript and `@types/node`: https://developers.cloudflare.com/workers/languages/typescript/
- Workers Vitest integration and test tsconfig: https://developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/
- Test execution contexts and automatic compatibility flags: https://developers.cloudflare.com/workers/testing/vitest-integration/isolation-and-concurrency/
- `node:fs` Worker runtime behavior: https://developers.cloudflare.com/workers/runtime-apis/nodejs/fs/
- Vitest plugin configuration: https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/
- Context7 result (Cloudflare Workers SDK): https://context7.com/api/v2/context?libraryId=/cloudflare/workers-sdk&query=Cloudflare%20Workers%20Vitest%20integration%20TypeScript%20test%20files%20importing%20node%3Afs%20whether%20to%20install%20%40types%2Fnode%20in%20worker%20devDependencies%20types%20recommended%20alternative%20test%20environment&type=txt
