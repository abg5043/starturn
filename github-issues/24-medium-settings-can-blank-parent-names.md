# [MEDIUM] Settings API accepts missing parent name fields — can blank out names silently

**Labels:** `bug` `medium` `backend` `data-integrity`

## Summary

The `POST /api/settings` endpoint will overwrite `parent1_name` and `parent2_name` with empty strings if those fields are missing from the request body. While the current frontend always sends both fields, a direct API call (or a bug in the frontend) could silently erase parent names across the entire app.

## Affected Code

`server.ts` settings update handler (approximately lines 629-652):

```ts
const parent1 = sanitize(req.body.parent1) || '';
const parent2 = sanitize(req.body.parent2) || '';
// If req.body.parent1 is undefined: sanitize(undefined) = '', then || '' = ''
// The empty string is then written to the database
```

## Impact

- Parent names show as blank in the header, all UI, and journal entries
- Journal entries already written reference the names at log time — only future entries would be blank
- App becomes confusing: "'' is up first tonight" with an empty string in UI

## Fix

### Option A: Validate non-empty before accepting

```ts
const parent1 = sanitize(req.body.parent1);
const parent2 = sanitize(req.body.parent2);

if (!parent1 || !parent2) {
  return res.status(400).json({ error: 'Both parent names are required.' });
}
```

### Option B: Only update provided fields (PATCH-style)

Only update fields that were explicitly sent in the request body:

```ts
const updates: Record<string, unknown> = {};

if (req.body.parent1 !== undefined) {
  const name = sanitize(req.body.parent1);
  if (!name) return res.status(400).json({ error: 'Parent 1 name cannot be empty.' });
  updates.parent1_name = name;
}

if (req.body.parent2 !== undefined) {
  const name = sanitize(req.body.parent2);
  if (!name) return res.status(400).json({ error: 'Parent 2 name cannot be empty.' });
  updates.parent2_name = name;
}

// Only update what was explicitly sent
```

Option A is simpler and preferred for a UI that always sends both fields.

### Frontend Validation

Also add client-side validation to the settings form so users see an error before the API call:

```tsx
const saveSettings = async () => {
  if (!settingsParent1Name.trim() || !settingsParent2Name.trim()) {
    showToast('Both parent names are required.');
    return;
  }
  // ... proceed with save
};
```

## Verification Steps

1. Make a direct API call with only one parent name:
   ```
   POST /api/settings
   { "parent2": "Bob" }  <- parent1 omitted
   ```
2. **Expected:** 400 response — "Both parent names are required."
3. **Actual (current):** 200 response, parent1_name set to ''

4. Reload the app → **Expected:** Parent 1's name is preserved
5. **Actual (current):** Parent 1's name is blank throughout the UI
