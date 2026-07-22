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

Set `VITE_FIREBASE_RTDB_URL` in `.env` / Vercel (see `.env.example`). Analytics
are skipped when the URL is empty or invalid.
