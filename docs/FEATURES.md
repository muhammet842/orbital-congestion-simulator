# Features

Post-MVP capabilities shipped in this repository (beyond the original `CURSOR_PROJECT_SPEC` checklist):

| Feature | Entry points |
|---------|----------------|
| Propagation Web Worker | `src/workers/propagation.worker.ts`, `PropagationWorkerBridge.ts` |
| 24h close-approach scan + verification | `src/orbital/conjunction.ts`, `ConjunctionVerification.ts` |
| Historical event 3D replay | `src/ui/EventCards.ts`, `EventReplayVisuals.ts` |
| Kessler Future Projection | `src/ui/KesslerPanel.ts`, `kesslerProjection.ts` |
| Interactive how-to tour | `src/ui/HowToGuide.ts` (language gate + spotlight steps, header `?`) |
| Satellite Spotter | `src/ui/SpotterPanel.ts`, `lookAngles.ts` |
| Admin analytics overlay | `src/ui/AdminPanel.ts`, `firebase/` |
| Deep links | `src/routing/deepLink.ts` (`?object=`, `?event=`) |
| i18n (en/tr/de/ru/zh) | `src/i18n/` |
| Newly tracked filter | `firstSeenAt` via `scripts/applyFirstSeenAt.mjs` |

See also [NEW_OBJECTS.md](./NEW_OBJECTS.md) and [OPERATIONS.md](./OPERATIONS.md).
