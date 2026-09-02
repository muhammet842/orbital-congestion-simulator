# Firebase Realtime Database (optional analytics)

The admin panel’s anonymous visitor metrics use Firebase RTDB over REST.
There is **no backend**, so rules must enforce safety in the database itself.

## Deploy rules (required)

Open rules (`.read: true` / `.write: true` on the root) let anyone wipe or
rewrite the database. Publish the least-privilege rules in this folder instead:

```bash
# one-time: firebase login && firebase use <your-project-id>
npx firebase-tools deploy --only database
```

Or paste `database.rules.json` into **Firebase Console → Realtime Database → Rules**
and click **Publish**.

### Verify production

1. In Firebase Console → Rules, confirm the published JSON matches this repo
   (increment-only metrics / presence schema — **not** open root write).
2. In Vercel → Project → Environment Variables, confirm `VITE_FIREBASE_RTDB_URL`
   points at that database.
3. Open the live app, unlock admin (Ctrl+Shift+A), and confirm metrics load
   without a connection error.
4. Full ops checklist: [docs/OPERATIONS.md](../docs/OPERATIONS.md).

## What the rules allow

| Path | Read | Write |
|------|------|-------|
| `orbital_metrics/{sat\|evt\|loads}` | public | create as `1`, or increment by exactly `+1` (no deletes / jumps) |
| `orbital_countries/{AA}` | public | same increment-only policy for ISO country codes |
| `orbital_presence/{sessionId}` | public | schema-validated presence upsert + delete; no other shapes |
| everything else | denied | denied |

## Residual risk (no backend)

Anonymous clients can still spam `+1` increments. Stopping that needs App Check
or a server — out of scope for this static Vite app. Increment-only rules already
block wipe / arbitrary overwrite attacks.

## Client URL

Set `VITE_FIREBASE_RTDB_URL` in `.env` / Vercel (see `.env.example`).

- **Unset / valid URL** — uses that URL, or the built-in default when unset.
- **`off` / `disabled` / `false` / `0`** — remote analytics stay off.
- Invalid localStorage overrides also disable remote writes for that browser.
