# Decisions and spec deviations

Newest first. Each entry: date, decision, reason.

## 2026-10-08: Bridge engine tuning from the first live runs

- **Filters read names and classifying tags only** (genre / subgenre / category). Incidental tags caused false rejections: Jazz at Lincoln Center was rejected for the amenity tag "wheelchair accessible parking lot", and Weyes Blood for the theme tag "spirituality". Places of worship are excluded as venues (religion is out of scope).
- **Novelty modulates, it doesn't dominate.** The novelty factor runs 0.5–1 across the popularity band [0.3, 0.9]. With a full 0–1 range, a 54th/85th-percentile show outranked a 96th/96th-percentile one just for being less popular.
- **Rejection reasons distinguish** "one-sided" (one community low) from "weak support from both".
- **Result shape:** up to 3 bridges (one per domain first), 1 obvious contrast, up to 6 runners-up, shared themes, all rejections with reasons, and the full evidence ledger.
- A five-domain live run on Campus ↔ City NYC uses **21 Qloo calls and about 8–9 s**.

## 2026-10-07: Spike decisions

- **GO** with Campus ↔ City, New York as the main scenario. Jaipur is a backup that needs topic and venue filters.
- Video game type is `urn:entity:videogame`; it works for both search and Insights.
- Popularity method: within-pool percentiles × (1 − popularity). Division-based lift and neutral baselines were rejected.
- Production domains: tv_show, artist, book, podcast, place (movie optional). Brand and destination dropped as too generic.
- Analysis Compare is used for themes, and explainability for provenance.

## 2026-10-07: LLM = OpenAI through the ChatGPT subscription (no API key)

The agent uses the owner's ChatGPT subscription via the Codex backend (`chatgpt.com/backend-api/codex/responses`), with the device-code sign-in flow adapted from [earendil-works/pi](https://github.com/earendil-works/pi). Model defaults to `gpt-5.6-sol` (`LLM_MODEL`).

- One-time sign-in: `npm run llm:login`, which saves `.secrets/chatgpt-auth.json` (git-ignored) and auto-refreshes.
- The project keeps its own credential instead of reusing `~/.codex/auth.json`, because refresh tokens rotate and sharing them would log the Codex CLI out.
- Deployment note for Track 5: the credential file must be available to the server, and rotated refresh tokens must be persisted (e.g. KV) or the deployed app will lose its session. Pre-generating LLM output for prebuilt scenarios reduces this dependency.

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
