# Decisions and spec deviations

Newest first. Each entry: date, decision, reason.

## 2026-10-08: Web UI decisions (Track 4)

- **One client "Studio"** holds the scenario draft (a reducer) and the run state built from the event stream. Later steps unlock as soon as their data arrives: bridges appear about 20 s in, before the LLM steps finish.
- **Prebuilt scenarios store names and types only** and are resolved through Qloo on load, so no Qloo data is committed.
- **Qloo search pacing:** loading a scenario fired 16 parallel searches and Qloo returned 429. The client now sends one request, and the server allows 3 searches at a time across requests.
- **Intake privacy:** only per-entity counts and a participant counter are stored, with no names, emails, IPs or free text. Without Upstash env vars the store is in-memory, and the UI labels it "dev storage".
- **Colour code:** community A cobalt, community B terracotta, the bridge plum, used everywhere (bars, roles, chips) so viewers always know whose evidence they're looking at.
- **With/without-Qloo view** counts discovered entities, two-sided anchors and evidence citations, and labels every baseline anchor as "seed" (reused) or "unverified". In live runs the LLM-only version reused only the seeds it was given.

## 2026-10-08: Agent and API decisions (Track 3)

- **Core domains always run.** The LLM planner may add or reorder domains, but TV shows and places (when there's a location) are always included. In the first full live run the planner dropped TV, and the strongest bridge (Somebody Somewhere) disappeared.
- **The LLM references entities by brief ref** (B1, R2...), never by free text. A guard resolves refs to Qloo entities, drops the obvious contrast and unknown refs, removes uncited evidence IDs, and strips quoted titles that aren't in the evidence. Both the draft and the critic's revision are guarded.
- **API shape:** analysis runs inside one streamed POST request instead of start + events endpoints, because serverless hosts kill background work after a response is sent. Program regeneration is stateless (`{ brief, bridgeRef }`).
- **Timings (live, NYC):** plan ~7 s, Qloo engine ~8 s, notes and program in parallel ~37 s, critic ~26 s; ~80 s total. The baseline (~22 s) runs in parallel. Prebuilt demo scenarios must be cached (step 5.1).
- **Observed quality:** every session is anchored to a Qloo entity, and the guard removed nothing. The critic flagged copy-pasted community roles and the revision made them distinct. The LLM-only baseline only reused the seeds it was given and discovered nothing new.

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
