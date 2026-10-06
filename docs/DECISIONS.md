# Decisions and spec deviations

Newest first. Each entry: date, decision, reason.

## 2026-10-06: No real Qloo responses in the public repo

The hackathon developer guide says server-side caching of Qloo responses is permitted but **storing them in a public repository is prohibited**.

- Real API responses go only to git-ignored folders: `spike/out/` and `fixtures/local/`.
- Committed test fixtures in `fixtures/` are **synthetic**: hand-written, matching the documented response shape, with fake IDs and made-up names.
- Any runtime response cache is server-side only (memory or KV), never committed.

## 2026-10-06: Video game type URN is ambiguous

The hackathon guide lists `urn:entity:video_game`, while the Insights and Search references list `urn:entity:videogame`. The client keeps the URN as configuration (`QLOO_TYPES` in `src/lib/qloo/types.ts`) and the spike (step 1.5) must confirm which one the hackathon key accepts.

## 2026-10-06: Next.js 16 + `next typegen`

The scaffold is Next.js 16.3. Global route types such as `LayoutProps` are generated, so `npm run typecheck` runs `next typegen` before `tsc`.

## 2026-10-06: `@types/node` pinned to ^22

Vitest 5 requires `@types/node` ≥ 22; the scaffold shipped ^20.
