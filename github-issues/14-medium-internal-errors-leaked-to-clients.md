# [MEDIUM] Internal error messages leaked to API clients

**Labels:** `security` `medium` `backend`

## Summary

API error handlers throughout `server.ts` return `error.message` in the JSON response. This exposes internal implementation details — SQLite table names, file paths, stack information embedded in error messages — to any client.

## Example Affected Code

Pattern repeated across many endpoints in `server.ts`:

```ts
} catch (error) {
  console.error('Error:', error);
  res.status(500).json({ error: error.message });
  //                             ^^^^^^^^^^^^^ leaks internal details
}
```

## What Gets Leaked

Depending on what fails, a client could see messages like:
- `SQLITE_CONSTRAINT: UNIQUE constraint failed: families.email`
- `no such column: settings.invalid_field` (reveals schema)
- `ENOENT: no such file or directory, open './data/starturn.db'` (reveals deployment path)
- `Cannot read properties of undefined (reading 'family_id')` (reveals code structure)

## Fix

Return a generic message to clients; log the real error server-side only:

```ts
} catch (error) {
  console.error('[API Error]', req.path, error); // full error in server logs
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}
```

For **known/expected** errors (validation failures, not-found, etc.), continue returning specific user-friendly messages:

```ts
// Good — specific, user-facing, no internal details
res.status(400).json({ error: 'Parent names cannot be empty.' });
res.status(404).json({ error: 'Family not found.' });

// Bad — leaks internals
res.status(500).json({ error: error.message });
```

## Implementation Note

A simple wrapper utility can standardize this across all endpoints:

```ts
function handleApiError(res: Response, error: unknown, path: string) {
  console.error(`[API Error] ${path}:`, error);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
}

// Usage:
} catch (error) {
  handleApiError(res, error, '/api/complete-turn');
}
```

## Verification Steps

1. Set a breakpoint or temporarily force an exception in any API route
2. Inspect the HTTP response body in DevTools
3. **Expected:** `{ "error": "Something went wrong. Please try again." }`
4. **Actual (current):** `{ "error": "SQLITE_CONSTRAINT: ..." }` or similar
