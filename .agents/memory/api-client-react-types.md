---
name: api-client-react generated types
description: How the orval-generated React Query hooks need to be fixed for React Query v5 compatibility, and how declarations are built.
---

# api-client-react Generated Types

## Problem
The orval-generated `lib/api-client-react/src/generated/api.ts` uses `query?: UseQueryOptions<...>` for hook parameter types. In React Query v5, `UseQueryOptions` requires `queryKey`, but the generated hooks supply a default `queryKey` internally. This causes TypeScript errors at every call site.

## Fix applied
Replaced all `query?: UseQueryOptions<...>` parameter-type occurrences with `query?: Omit<UseQueryOptions<...>, 'queryKey'> & { queryKey?: QueryKey }` using a Node.js script.

**Why:** The hooks already default the `queryKey` internally via `queryOptions?.queryKey ?? getXxxQueryKey()`, so callers should not need to provide it.

**How to apply:** If the API spec changes and orval regenerates `api.ts`, run the fix script again:
```javascript
const fs = require('fs');
let src = fs.readFileSync('lib/api-client-react/src/generated/api.ts', 'utf8');
// Fix multiline pattern
let fixed = src.replace(
  /( {2}query\?): UseQueryOptions<(\s+Awaited<ReturnType<typeof [^>]+>>,\s+TError,\s+TData\s+)>;/g,
  (m, p, inner) => p + `: Omit<UseQueryOptions<` + inner + `>, 'queryKey'> & { queryKey?: QueryKey };`
);
// Fix single-line pattern
fixed = fixed.replace(
  /( {2}query\?): UseQueryOptions<([^>]+(?:>[^>]*)*?)>;/g,
  (m, p, inner) => p + `: Omit<UseQueryOptions<` + inner + `>, 'queryKey'> & { queryKey?: QueryKey };`
);
fs.writeFileSync('lib/api-client-react/src/generated/api.ts', fixed);
```

## Declarations must be rebuilt
After editing `lib/api-client-react/src/generated/api.ts`, run:
```
cd lib/api-client-react && pnpm exec tsc -p tsconfig.json
```
The control-center tsconfig has `api-client-react` as a project reference and needs the `dist/` declarations.

## Other page-level issues fixed
- Deep imports like `@workspace/api-client-react/src/generated/api.schemas` → use `@workspace/api-client-react` (root export)
- `keepPreviousData` (React Query v4) → remove or use `placeholderData` (React Query v5)
- `next-themes/dist/types` → `next-themes` (types are now exported from root)
- `noImplicitAny` on map callbacks → add explicit types

## Trust proxy
Added `app.set("trust proxy", 1)` to `artifacts/api-server/src/app.ts` so session cookies are set correctly behind Replit/Railway reverse proxy.
