# Operations checklist

## TLE refresh

- Workflow: [`.github/workflows/tle-refresh.yml`](../.github/workflows/tle-refresh.yml) (Monday & Thursday).
- Manual: `npm run fetch-tle` then commit `public/data/tle.json` if needed.
- Each fetch pulls CelesTrak **TLE groups** and joins **SATCAT** (`satcat.csv`) for country/owner fields. If SATCAT is temporarily unavailable, the script still writes TLEs and the UI falls back to name heuristics.
- In-app UI warns when `fetchedAt` is older than ~3 days — keep Actions green.
- Verify on GitHub → **Actions → TLE Refresh** that the latest run succeeded.
- Live catalog: open the deployed app and check **Live Stats → TLE data updated**.

## Firebase rules

Rules in `firebase/database.rules.json` are **not** applied until you publish them:

```bash
npx firebase-tools login
npx firebase-tools use <project-id>
npx firebase-tools deploy --only database
```

Or paste/publish via Firebase Console → Realtime Database → Rules.

Confirm:

1. Root is **not** open (`.read`/`.write` true).
2. Only `orbital_metrics`, `orbital_countries`, `orbital_presence` paths match the README table.
3. `VITE_FIREBASE_RTDB_URL` is set in Vercel for production analytics.

Residual risk (spam `+1`) is documented in `firebase/README.md` — App Check would be needed to stop it.

## CI

- Unit tests + build: every push/PR.
- Playwright e2e: push to `main` **and** pull requests targeting `main`.
