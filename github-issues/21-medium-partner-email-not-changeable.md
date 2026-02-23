# [MEDIUM] Partner email cannot be changed after setup

**Labels:** `ux` `medium` `feature`

## Summary

The Settings modal has no way to correct the partner email address entered during setup. If a typo was made, the wrong person was invited, the relationship changed, or the partner created a new account with a different email, there is no recovery path from the UI.

## Impact

- Mistyped partner email during setup means the invite is permanently wrong
- Users who realize the mistake are stuck unless they can edit the DB directly
- No app-level way to "reset" the partner connection

## Fix — Add Partner Email Field to Settings

In the Settings modal, under the "Family" section, add an editable partner email field:

```tsx
{/* Only shown to parent who created the family (parent1) */}
{state.settings.is_parent1 && (
  <div>
    <label className="block text-sm font-medium text-indigo-200 mb-2">
      Partner's Email
    </label>
    <input
      type="email"
      value={settingsPartnerEmail}
      onChange={e => setSettingsPartnerEmail(e.target.value)}
      placeholder="partner@example.com"
      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white"
    />
    {state.settings.parent2_joined ? (
      <p className="text-xs text-indigo-300/60 mt-1">
        ✓ {state.settings.parent2_name} has joined
      </p>
    ) : (
      <p className="text-xs text-amber-300/70 mt-1">
        ⏳ Invite pending — hasn't joined yet
      </p>
    )}
  </div>
)}
```

### Backend Support

`POST /api/settings` needs to handle an optional `partner_email` field:

```ts
if (partnerEmail && partnerEmail !== currentSettings.partner_email) {
  // Validate format
  if (!isValidEmail(partnerEmail)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }
  // Update partner email, revoke existing partner session if any, resend invite
  db.prepare(`UPDATE settings SET partner_email = ? WHERE family_id = ?`)
    .run(partnerEmail, familyId);
  // Optionally: resend the invite email automatically
  await sendMagicLink(partnerEmail, familyId);
}
```

## Additional Consideration — Changing Your Own Email

There is also no way to change the primary account email. This is lower priority but worth tracking.

## Verification Steps

1. Complete setup with a partner email containing a deliberate typo
2. Open Settings
3. **Expected:** Partner email field is visible and editable (parent1 only)
4. Correct the typo and save
5. **Expected:** New invite is sent to the corrected address; previous invite is invalidated
6. Log in as the partner with the corrected email
7. **Expected:** Successfully joins the family
