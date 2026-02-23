# [LOW] Remove unused `@google/genai` dependency and `cn()` utility

**Labels:** `chore` `low` `cleanup`

## Summary

Two pieces of dead code are present in the codebase that should be removed:

1. `@google/genai` is listed in `package.json` and a `GEMINI_API_KEY` env var is exposed in `vite.config.ts`, but neither the server nor any frontend file imports or uses the Google GenAI SDK.

2. `src/lib/utils.ts` exports a `cn()` (classnames) utility function, but it is imported nowhere in the project.

## Dead Code Details

### `@google/genai`

`package.json` — in dependencies:
```json
"@google/genai": "^x.x.x"
```

`vite.config.ts` — environmental exposure:
```ts
define: {
  'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY)
}
```

No import of `@google/genai` exists anywhere in `src/` or `server.ts`.

### `cn()` utility

`src/lib/utils.ts`:
```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

No file in `src/` imports `cn` from `utils.ts`.

This also means `clsx` and `tailwind-merge` are installed dependencies that serve no purpose.

## Fix

1. Remove `@google/genai` from `package.json` dependencies
2. Remove the `GEMINI_API_KEY` define from `vite.config.ts`
3. Delete `src/lib/utils.ts` (or keep if `cn` will be used soon)
4. Remove `clsx` and `tailwind-merge` from `package.json` if not used elsewhere
5. Run `npm install` to update `package-lock.json`

```bash
npm uninstall @google/genai clsx tailwind-merge
```

## Why Now

- Smaller `node_modules` → faster installs and builds
- Fewer dependencies → smaller attack surface
- The `GEMINI_API_KEY` env var is exposed to the Vite bundle via `define`, which means it could be included in the client JS if ever referenced. Removing it prevents accidental key exposure.

## Verification Steps

1. Remove the packages and run `npm install`
2. Run the build: `npm run build` → **Expected:** No errors, bundle size reduces
3. Run the app → **Expected:** All features still work identically
4. Search codebase for `genai`, `cn(`, `clsx`, `twMerge` → **Expected:** No results
