# COMMON GROUND: Implementation Guide

This is the build manual for COMMON GROUND. The product plan and reasoning are in [`common_ground_research_and_plan.md`](common_ground_research_and_plan.md) (Revision 3.0). This file says **what to build, in what order, and how to commit it.**

Work is split into **5 tracks**, and each track into numbered **steps** (`1.1`, `1.2`, …). To run one, say:

> "Implement step 2.3" or "Implement track 2"

---

## Current status (handoff for new sessions)

> **Keep this section current.** Update it at the end of every step: last updated, what works, known issues, and next step.

**Last updated:** 2026-10-08 · **Commits:** ~145 · **Tests:** 112 passing · **Build:** passing

**Done:** Track 0, Track 1 (API spike: GO), Track 2 (bridge engine), Track 3 (AI agent and API), Track 4 (the full web UI).
**Next:** **Track 5, step 5.1** (prebuilt scenarios and response caching), so the judge demo doesn't wait ~80 s.

**What works today (all verified live):**
- Qloo client (`src/lib/qloo/`): search, tags, insights (incl. explainability), Analysis Compare.
- Bridge engine (`src/lib/engine/`): `runBridgeEngine(client, scenario)` returns 3 bridges, the obvious contrast, runners-up, themes, rejections and the evidence ledger. About 21 Qloo calls and 8–9 s.
- AI agent (`src/lib/agent/`): planner, bridge notes, entity-anchored program, critic, and an LLM-only baseline, run by `runAgent()` in `orchestrator.ts`. About 80 s live.
- API (`src/app/api/`):
  - `POST /api/entities/resolve`
  - `POST /api/analysis` (streams server-sent events; the last event is `done` with the full result)
  - `POST /api/program` (regenerate for another bridge)
- Web UI (`src/components/`, `src/app/page.tsx`), all verified live in the browser, including at phone width:
  1. **Profiles:** prebuilt scenarios resolve through Qloo on load; add, confirm or change seeds; ambiguity flags; retry.
  2. **Investigate:** live stages, per-domain progress and an activity feed, from the event stream.
  3. **Bridges:** the Obvious vs Discovered centrepiece, three bridge cards (support bars, popularity, supporting seeds, interpretation notes, Qloo evidence), themes, runners-up and rejections.
  4. **Program:** Qloo-anchored sessions, community roles, the critic's review, export and print, rebuilding on another bridge, and the **with/without-Qloo comparison**.
- Participant intake: `/join/[id]/[side]` (mobile-first). Organizers create the links and import the totals on screen 1. Storage is Upstash Redis when `UPSTASH_REDIS_REST_URL`/`TOKEN` are set, otherwise **in-memory (dev only)**.
- Demo scenario: **Campus ↔ City, New York** (main) and Jaipur (backup). Prebuilt scenarios store names only (`src/scenarios/index.ts`). Seeds are in `spike/seeds.json`. They are *hypothetical test seeds*.

**Environment setup on a new machine or session:**
1. `npm install`
2. Copy `.env.example` to `.env.local` and set `QLOO_API_KEY` (the hackathon key; base URL `https://hackathon.api.qloo.com`).
3. The LLM is OpenAI through the owner's **ChatGPT subscription**, with no API key. Run `npm run llm:login` once to sign in by device code; it saves `.secrets/chatgpt-auth.json` (git-ignored) and refreshes automatically.
4. Verify: `npm run spike spike/00-ping.ts` (Qloo) and `npm run spike spike/00-llm-ping.ts` (LLM).
5. Useful live scripts:
   - `spike/01-resolve.ts` writes `spike/out/resolved.json`, which the other scripts need.
   - `spike/run-engine.ts`
   - `spike/run-agent.ts [scenarioId]`

**Known issues and to-dos:**
- A full live run takes about 80 s, so prebuilt demo scenarios **must be cached** (step 5.1) and the UI must show live progress (step 4.4).
- Disconnecting the client doesn't cancel a running analysis (fix in 5.2).
- Qloo rate-limits bursts (429). Searches are paced server-side (3 at a time); keep that in mind for caching and evaluation runs.
- Intake needs an Upstash Redis database for deployment: the owner must create one (free tier) and set the two env vars.
- Commit `1a2227f` imports a file added two commits later, so it doesn't build on its own (history only; `main` builds).
- The engine thresholds were tuned on one scenario; check them in the evaluation (5.3).
- Bridge #3 is often weak (Bridge Potential ~35). Film and music rarely win.
- Deployment: the ChatGPT credential file must be available to the server, and rotated refresh tokens persisted (decide in 5.4).

**Where to look:** plan → `common_ground_research_and_plan.md` · decisions → `docs/DECISIONS.md` · spike results → `docs/SPIKE_FINDINGS.md`.

---

## How an AI session should use this file

When asked to implement a step or track:

1. Read this file and the relevant sections of the plan.
2. Check the **Progress tracker** below. Don't redo finished steps. If a step depends on an unfinished one, say so and stop.
3. Implement the step exactly as specified. If reality differs from the spec (e.g. the Qloo API behaves differently), follow reality, note the difference in `docs/DECISIONS.md`, and update this file.
4. **Commit in small, meaningful pieces while working** (see the commit rules). Don't wait until the end.
5. Run the step's **Done when** checks.
6. Tick the step in the progress tracker, **update the "Current status" section** (date, commit and test counts, what works, known issues, next step), commit that change, and `git push`.
7. Reply with a short summary: what was built, which commits were made, and anything blocked.

Never commit secrets. The Qloo key lives only in `.env.local`, and the ChatGPT sign-in only in `.secrets/`. Both are git-ignored.

Never commit real Qloo API responses. Qloo's hackathon terms prohibit storing them in a public repository. Use git-ignored `spike/out/` or `fixtures/local/`; committed fixtures must be synthetic.

---

## Commit rules (always follow)

The aim is a clean, honest history with many commits. Each commit should be one small but real step that a reviewer could understand on its own.

- **One logical change per commit.** Adding a type, adding a function, adding its test, and wiring it in are separate commits.
- **Typical step = 3–8 commits.** If a step ends with one giant commit, it was committed wrong.
- **Commit whenever something works**: a script runs, a test passes, a screen renders.
- **Format:** [Conventional Commits](https://www.conventionalcommits.org/)
  ```text
  feat(engine): add harmonic-mean bilateral lift scoring
  test(engine): cover one-sided candidates in lift scoring
  fix(qloo): send API key in X-Api-Key header
  docs(spike): record popularity baseline findings
  chore: add .env.example
  refactor(ui): extract BridgeCard component
  ```
  Scopes: `qloo`, `spike`, `engine`, `agent`, `api`, `ui`, `intake`, `eval`, `docs`, `deploy`.
- **Every commit must build/run.** Don't commit broken code to `main`.
- **No fake commits.** No empty commits, whitespace-only commits, or splitting one line across commits. Many commits come from working in small steps, not from padding.
- **Push after every step** (`git push`), so the GitHub contribution graph updates daily.
- Commit author must use the email verified on the GitHub account (`Dhamani-aryan`), or commits won't count on the profile.
- End every commit message with the attribution line the session's tooling requires (if any).

---

## Progress tracker

| Step | Title | Status |
|---|---|---|
| 0.1 | Repository, plan, guide, license | ✅ done |
| 1.1 | Project scaffold (Next.js + TS + tooling) | ✅ done |
| 1.2 | Environment and secrets handling | ✅ done |
| 1.3 | Typed Qloo client | ✅ done (live-verified) |
| 1.4 | Spike script: entity resolution | ✅ done |
| 1.5 | Spike script: A / B / combined Insights | ✅ done |
| 1.6 | Spike script: popularity baseline and lift | ✅ done |
| 1.7 | Spike script: explainability, compare, location | ✅ done |
| 1.8 | Spike findings and go/pivot decision | ✅ done |
| 2.1 | Core domain types and evidence ledger | ✅ done |
| 2.2 | Seed resolution service | ✅ done |
| 2.3 | Profile expansion across domains | ✅ done |
| 2.4 | Candidate generation | ✅ done |
| 2.5 | Bilateral validation | ✅ done |
| 2.6 | Normalization and popularity lift | ✅ done |
| 2.7 | Bridge Potential scoring and diverse selection | ✅ done |
| 2.8 | Engine CLI and fixture-based tests | ✅ done |
| 3.1 | LLM client with structured (Zod) outputs | ✅ done |
| 3.2 | Domain planner | ✅ done |
| 3.3 | Bridge notes (activity fit, friction) | ✅ done |
| 3.4 | Program generator: entity lineup | ✅ done |
| 3.5 | Critic pass and evidence guard | ✅ done |
| 3.6 | LLM-only baseline | ✅ done |
| 3.7 | Orchestrator, state machine, and event stream | ✅ done |
| 3.8 | Analysis API routes | ✅ done |
| 4.1 | Design system and layout shell | ✅ done |
| 4.2 | Screen 1: profiles and seed confirmation | ✅ done |
| 4.3 | Participant intake page and KV store | ✅ done |
| 4.4 | Screen 2: live agent investigation | ✅ done |
| 4.5 | Screen 3: bridge comparison (Obvious vs Discovered) | ✅ done |
| 4.6 | Screen 4: program lineup and provenance | ✅ done |
| 4.7 | With/without-Qloo comparison view | ✅ done |
| 4.8 | Empty, partial, error, and insufficient-evidence states | ✅ done |
| 5.1 | Prebuilt scenarios and response caching | ⬜ |
| 5.2 | Reliability: budgets, timeouts, retries, rate limiting | ⬜ |
| 5.3 | Evaluation run (6 cases + ablation) | ⬜ |
| 5.4 | Deployment to Vercel | ⬜ |
| 5.5 | README, architecture, limitations, responsible use | ⬜ |
| 5.6 | Screenshots, submission copy, final checks | ⬜ |

---

## When the Qloo API key arrives

1. Copy `.env.example` to `.env.local` and paste the key into `QLOO_API_KEY=`.
2. Run the live check: `npm run spike spike/00-ping.ts`. All three checks should pass.
   - `401` means a wrong key or base URL. Hackathon keys only work on `https://hackathon.api.qloo.com`.
3. Then say **"implement step 1.4"** and continue through Track 1 (the API spike).

---

## Target repository layout

```text
qloo-hackathon/
├── common_ground_research_and_plan.md
├── IMPLEMENTATION.md
├── CLAUDE.md
├── README.md
├── LICENSE
├── .env.example
├── docs/
│   ├── DECISIONS.md          design decisions and spec deviations
│   ├── SPIKE_FINDINGS.md     results of Track 1
│   ├── EVALUATION.md         results of 5.3
│   └── screenshots/
├── spike/                    throwaway exploration scripts (tsx)
├── fixtures/                 SYNTHETIC Qloo-shaped responses for tests (real ones: fixtures/local/, git-ignored)
├── src/
│   ├── app/                  Next.js App Router pages + API routes
│   ├── components/
│   ├── lib/
│   │   ├── qloo/             Qloo client + response normalizers
│   │   ├── engine/           deterministic bridge engine
│   │   ├── agent/            orchestrator, planner, generator, critic
│   │   ├── llm/              LLM client
│   │   ├── intake/           participant intake store
│   │   └── types.ts
│   └── scenarios/            prebuilt demo scenarios
└── tests/
```

**Stack:** Next.js (App Router) + TypeScript (strict) + Tailwind CSS + Zod + Vitest + `tsx` for scripts. npm as the package manager. LLM: OpenAI through the ChatGPT subscription (`src/lib/llm/`, sign in once with `npm run llm:login`; model from `LLM_MODEL`, default `gpt-5.6-sol`). Upstash Redis for intake only. Deploy on Vercel.

---

# Track 0: Setup ✅

### Step 0.1: Repository, plan, guide, license ✅
Repo `qloo-hackathon` created with the plan, this guide, `CLAUDE.md`, `README.md`, MIT `LICENSE`, and `.gitignore`.

---

# Track 1: Foundation and API spike

**Goal:** find out from live data whether the idea works before building the product.
**Exit gate:** `docs/SPIKE_FINDINGS.md` answers the decisive question (plan §18) with a go/pivot decision.
**Needs:** Qloo hackathon API key.

### Step 1.1: Project scaffold
- `npx create-next-app@latest` in the repo root (TypeScript, App Router, Tailwind, ESLint, `src/` dir, no Turbopack-specific config needed). Don't overwrite the existing docs.
- Add Vitest, Zod, `tsx`, Prettier. Scripts: `dev`, `build`, `lint`, `test`, `typecheck`, `spike`.
- Enable `strict` in `tsconfig.json`.
- Replace the default home page with a one-line placeholder ("COMMON GROUND: coming soon").

**Commits:** scaffold → add vitest + sample test → add prettier/typecheck scripts → placeholder page.
**Done when:** `npm run build`, `npm test`, and `npm run typecheck` pass.

### Step 1.2: Environment and secrets
- `.env.example` with `QLOO_API_KEY=`, `QLOO_BASE_URL=https://hackathon.api.qloo.com`, `ANTHROPIC_API_KEY=`, `LLM_MODEL=claude-sonnet-5`, `UPSTASH_REDIS_REST_URL=`, `UPSTASH_REDIS_REST_TOKEN=`.
- `src/lib/env.ts`: Zod-validated server-only env loader (`import "server-only"` for app code; a plain variant for scripts).
- Confirm `.env.local` is git-ignored.

**Commits:** env example → validated env loader → test for missing-key error.
**Done when:** a missing key gives a clear error and no secret appears in `git status`.

### Step 1.3: Typed Qloo client
`src/lib/qloo/client.ts`, implementing the `QlooClient` interface from plan §13:
- `searchEntities`, `searchTags`, `getInsights`, `compareProfiles`.
- GET requests with query params; key in `X-Api-Key`; base URL from env.
- Timeout (8s), at most 2 retries with exponential backoff on 429/5xx, no retry on 4xx.
- Optional raw-response dump to `spike/out/` when `QLOO_DUMP=1` (git-ignored).
- Normalizers in `src/lib/qloo/normalize.ts` turn raw responses into internal types (`EntityMatch`, `InsightsResult`). **Warn when a 200 response has empty results**, because Qloo may silently ignore bad params.

**Commits:** request helper + errors → search methods → insights method → compare method → normalizers → unit tests with mocked fetch.
**Done when:** tests pass, and one live call from a quick script returns entities.

### Step 1.4: Spike, entity resolution
`spike/01-resolve.ts`:
- Input: `spike/seeds.json` with two scenarios (Campus ↔ City first, Jaipur backup), each with 2 communities and 6–8 seeds across ≥2 domains (artists, films, books, TV, places).
- Resolve each seed through `/search`; print top 3 matches with type and ID.
- Write resolved IDs to `spike/out/resolved.json` and the hit rate per scenario to the console.

**Commits:** seed file → resolve script → results summary.
**Done when:** each seed has a confirmed ID or is marked unresolved, and the resolution rate per scenario is recorded.

### Step 1.5: Spike, A / B / combined Insights
`spike/02-insights.ts`:
- For each output type (movie, artist, tv_show, book, place, brand, videogame, destination; exact URNs from the hackathon docs), query Insights with: A seeds, B seeds, A+B seeds. `take=25`.
- Record result count, latency, and the numeric fields present (affinity, popularity, rank, …).
- Find overlap: entities in both A and B results.
- Save real responses to `fixtures/local/` (git-ignored). **Qloo prohibits storing its responses in a public repo** (see `docs/DECISIONS.md`). Then hand-write *synthetic* fixtures in `fixtures/` with the same shape, fake IDs and made-up names, for committed tests.

**Commits:** insights script → overlap analysis → fixtures.
**Done when:** a table of type × {A, B, A+B, overlap count, latency} exists.

### Step 1.6: Spike, popularity baseline and lift ⭐ (most important)
`spike/03-lift.ts`:
- Test each baseline option from plan §8 Stage 5b: entity popularity field; neutral/no-signal query rank; popularity filter cap.
- For each overlap candidate compute `liftA`, `liftB`, and harmonic mean.
- Print two lists side by side: **top by raw bilateral support** vs **top by bilateral lift**.
- A person (the user) reads the lift list and judges: are ≥3 items non-obvious and plausible for both groups?

**Commits:** baseline fetchers → lift computation → side-by-side report.
**Done when:** the side-by-side report exists for Campus ↔ City and the user has given their verdict.

### Step 1.7: Spike, explainability, compare, location
`spike/04-features.ts`:
- `feature.explainability=true` on the A+B query: does it return per-seed contributions?
- `/v2/analysis/compare` with A vs B: what does it return, and is it useful?
- `filter.results.entities` shortlist scoring against A and against B.
- Location: the same Insights call for `place` with the candidate city; check that the results are real local venues.
- Taste analysis (`filter.type=urn:tag`) for theme labels.

**Commits:** one commit per feature tested, plus a fixture commit.
**Done when:** each feature is marked works / partial / unavailable.

### Step 1.8: Spike findings and decision
Write `docs/SPIKE_FINDINGS.md`: the answers to the 9 required questions in plan §18, the chosen popularity baseline, the 3–5 production domains, the chosen city, latency per call, and **the decision: GO / extra day / PIVOT**. Update the plan and this guide if anything changes.

**Commits:** findings doc → plan/guide adjustments.
**Done when:** the decision is recorded. **Don't start Track 4 before this.**

---

# Track 2: Bridge engine (deterministic, no LLM)

**Goal:** profiles in, ranked bridges with evidence out. Reproducible and fully tested on fixtures.
**Exit gate:** every ranked candidate links to stored Qloo evidence (plan §17 gate).

### Step 2.1: Core types and evidence ledger
`src/lib/types.ts` and `src/lib/engine/ledger.ts`:
- Types: `Seed`, `CommunityProfile` (with `source: "intake" | "organizer"` and `contributorCount`), `Candidate`, `Evidence` (schema in plan §13 incl. `popularityBaseline`, `lift`), `Bridge`, `AnalysisResult`.
- `EvidenceLedger` class: `add(evidence) → evidenceId`, `forCandidate(id)`, `toJSON()`.
- Zod schemas mirror the types.

**Commits:** types → Zod schemas → ledger → ledger tests.

### Step 2.2: Seed resolution service
`src/lib/engine/resolve.ts`: input strings in, `EntityMatch[]` candidates per seed out, with ambiguity flags (top-2 score gap small, or type mismatch). Seeds stay unconfirmed until the user confirms them.

**Commits:** resolver → ambiguity rules → tests on fixtures.

### Step 2.3: Profile expansion
`src/lib/engine/expand.ts`: for each production domain, run A, B, and A+B Insights queries with bounded concurrency (max 4 in flight) and a per-analysis call budget. Every result row is written to the ledger.

**Commits:** expansion → concurrency/budget limiter → tests.

### Step 2.4: Candidate generation
`src/lib/engine/candidates.ts`: build the pool from the combined A+B top results plus the combined results with `filter.popularity.max=0.9` (≤ 50 per domain). A∩B overlap of separate top lists is too strict (spike: zero overlap for NYC films, music, books). Themes come from Analysis Compare shared tags. Deduplicate by entity ID. Record which rule admitted each candidate.

**Commits:** overlap rule → combined/explainability rule → tag rule → dedupe + tests.

### Step 2.5: Bilateral validation
`src/lib/engine/validate.ts`: score each candidate against A and against B (shortlist query with `filter.results.entities` if the spike confirmed it, else rank in the A/B lists). Reject candidates with one-sided support. Label evidence `direct | rank-based | tag-based | location-conditioned`.

**Commits:** validator → rejection reasons → tests.

### Step 2.6: Normalization and popularity lift
`src/lib/engine/normalize.ts` and `lift.ts`, using the method validated in `docs/SPIKE_FINDINGS.md`: within-pool percentiles `pctA`/`pctB` from shortlist scoring, `bilateral = harmonic_mean(pctA, pctB)`, `discovered = bilateral × (1 − popularity)` with popularity in [0.3, 0.9] and both percentiles ≥ 0.4. **Obvious bridge** = best bilateral among popularity ≥ 0.95. Add the sensitive-topic filter (religion/politics) and the place venue-type filter.

**Commits:** percentile → RRF → baseline → lift → tests including "popular item must not win" case.

### Step 2.7: Bridge Potential scoring and diverse selection
`src/lib/engine/score.ts`: the simplified formula in plan §8 Stage 6. `select.ts`: pick the top 3 *meaningfully different* bridges (different domains or themes), plus the single best obvious bridge for comparison. Return `insufficient evidence` if fewer than 1 validated candidate.

**Commits:** scoring → diversity selection → insufficient-evidence path → tests.

### Step 2.8: Engine CLI and fixture tests
`spike/run-engine.ts` runs the full engine on a scenario and prints ranked JSON. An end-to-end test runs the engine against the synthetic `fixtures/` with zero network calls, and its output is deterministic (snapshot).

**Commits:** CLI → e2e fixture test → snapshot.
**Done when:** the CLI prints 3 bridges + 1 obvious bridge for Campus ↔ City, and every one cites evidence IDs.

---

# Track 3: Agent and program generation

**Goal:** the LLM plans, explains, and designs, but never invents cultural entities.
**Exit gate:** full analysis + program from one function call, every entity in the program backed by the ledger.

### Step 3.1: LLM client
✅ Text generation through the ChatGPT subscription is already built (`src/lib/llm/chatgpt.ts`, `getLlm()`). Remaining: `src/lib/llm/structured.ts` with `generateStructured(schema, prompt)` with Zod validation and one repair retry; token and latency logging (no secrets, no raw profiles in logs).

**Commits:** client → structured output helper → tests with a mocked LlmClient.

### Step 3.2: Domain planner
`src/lib/agent/planner.ts`: given profiles + objective, choose 3–5 domains from the spike's supported set, with a one-line reason each. A deterministic fallback runs if the LLM fails.

**Commits:** planner prompt + schema → fallback → tests.

### Step 3.3: Bridge notes
`src/lib/agent/notes.ts`: for each bridge, generate labelled notes (activity fit, main friction, why it beats the obvious bridge). They must cite evidence IDs, and the UI marks them as *interpretation*.

### Step 3.4: Program generator, entity lineup
`src/lib/agent/program.ts`: generates the program schema from plan §10, including `lineup[]`. **Guard:** every `qlooEntityId` in the lineup must exist in the ledger; unknown entities are removed and logged.

**Commits:** schema → prompt → entity guard → tests (guard rejects invented entity).

### Step 3.5: Critic pass and evidence guard
`src/lib/agent/critic.ts`: runs the plan §10 checklist once, returns issues + revised program, and re-runs the entity guard on the revision. Unsupported cultural claims in prose are stripped.

### Step 3.6: LLM-only baseline
`src/lib/agent/baseline.ts`: same objective, community descriptions, and seed names, but **no Qloo data**. Produces the same program schema for side-by-side comparison.

### Step 3.7: Orchestrator and event stream
`src/lib/agent/orchestrator.ts`: the state machine from plan §9 (RESOLVE → … → EXPLAIN). It emits typed events (`domain_selected`, `qloo_query_done`, `candidate_found`, `candidate_rejected`, `bridge_ranked`, `program_ready`, `error`) through an async iterator. Only real actions are shown, with no fake chain-of-thought.

### Step 3.8: Analysis API routes ✅
Built as (deviation from the plan's endpoint list, see `docs/DECISIONS.md`):
- `POST /api/entities/resolve` resolves typed names to Qloo matches with ambiguity flags.
- `POST /api/analysis` runs the whole agent **inside one request** and streams `AgentEvent`s as server-sent events. The last event is `done` with the full result.
- `POST /api/program` is stateless: it takes `{ brief, bridgeRef }` and regenerates (and critiques) the program for another bridge.

Handlers live in `src/lib/server/handlers.ts` (testable with fakes), and route files in `src/app/api/**/route.ts`. A full live run takes about 80 s.

---

# Track 4: Product UI and participant intake

**Goal:** the four screens + intake page, polished enough that a judge understands the product in 3 minutes.
**Design:** clean, editorial, plenty of white space. Two community colours used consistently (A = one hue, B = another; the bridge uses a blend). Responsive down to 375px. Light and dark mode.

### Step 4.1: Design system and layout shell
Tailwind tokens (colours, type scale), app shell with a stepper (Profiles → Investigate → Bridges → Program), and reusable `Card`, `Badge`, `EvidenceChip`, `EntityTile` (image, name, type).

### Step 4.2: Screen 1, profiles and seed confirmation
Pick a prebuilt scenario or start custom. Two columns (A and B). Add seed → live Qloo resolution → confirm or choose an alternative. Objective and constraints field, optional city. Shows `source` and `contributorCount`.

### Step 4.3: Participant intake page and store
- `POST /api/intake/session` creates a session with two share links.
- `/join/[sessionId]/[side]`: mobile-first, three favourite picks, each resolved and confirmed, plus a privacy notice.
- Upstash Redis stores only `{entityId: count}` per side, with a TTL of 30 days.
- Screen 1 can import an intake session as the profile.

**Commits:** store module → session API → submit API → join page → import into Screen 1 → tests.

### Step 4.4: Screen 2, live investigation
Consumes the SSE stream: domains chosen, Qloo calls with counts, candidates found/rejected with reasons, and a progress indicator. Shown as a calm, scannable timeline, not a log dump.

### Step 4.5: Screen 3, bridge comparison ⭐ (the centrepiece)
The **Obvious vs Discovered** panel at the top: the obvious bridge (high raw support, low lift) next to the top discovered bridge (high lift on both sides), with A-side and B-side supporting seeds visible. Below it, three bridge cards: Bridge Potential, liftA/liftB bars, evidence breadth, locality, interpretation notes, and expandable provenance.

### Step 4.6: Screen 4, program lineup
Four session cards, each anchored to a Qloo entity (image + name + type) with "supported by A: … · B: …". Then roles, venue, accessibility, success measures, limitations, and the critic's fixes as one collapsible line. Export as Markdown/print.

### Step 4.7: With/without-Qloo view
Toggle or split view: COMMON GROUND program vs LLM-only baseline. Entities, specificity, and evidence that are missing from the baseline are highlighted automatically.

### Step 4.8: Empty, partial, error, and insufficient-evidence states
Every screen handles: no seeds resolved, ambiguous seeds, Qloo timeout, partial domain failure, no bilateral candidate ("insufficient evidence", with suggestions), and LLM failure (engine results still shown).

---

# Track 5: Evaluation, hardening, submission

**Goal:** a reliable public demo and a repo that judges respect.

### Step 5.1: Prebuilt scenarios and caching
`src/scenarios/`: main + backup scenario with confirmed seeds. A server-side cache is keyed by normalized Qloo request, and prebuilt scenarios are warmed so the judge demo is fast and reliable.

### Step 5.2: Reliability
Per-analysis Qloo call budget, per-IP rate limit on analysis and intake, global timeouts, and graceful degradation. Tested in incognito, on mobile, on a slow network, with an invalid key, and with empty results.

### Step 5.3: Evaluation run
`eval/`: 6 fixed profile pairs (1 held out). Run three conditions (LLM-only, direct overlap, COMMON GROUND) and record the technical metrics (plan §14). Collect ~5 reviewer ratings. Write `docs/EVALUATION.md` honestly, as informal feedback.

### Step 5.4: Deploy to Vercel
Connect the repo, set env vars in Vercel (never in code), use a production URL, and smoke-test the full flow from another device.

### Step 5.5: README and documentation
README: one-sentence pitch, screenshot, live URL, how it works (diagram from plan §13), how Qloo is used, setup (`.env.example`, `npm i`, `npm run dev`), evaluation summary, known limitations, responsible-use notes (plan §15), license.

### Step 5.6: Submission package
Screenshots in `docs/screenshots/`, submission copy (plan §20), repo set to **public**, license visible in the GitHub About section, Git history checked for secrets (`git log -p | grep -i key`), and all public URLs tested logged-out. Submit by **October 29**.

---

## Schedule mapping (adjusts to when the key arrives)

| Window | Track |
|---|---|
| Key arrival + 0–2 days | Track 1 (1.1–1.3 can start before the key) |
| next ~5 days | Track 2 |
| next ~4 days | Track 3 |
| next ~5 days | Track 4 |
| Oct 25–29 | Track 5 |
| Oct 30 | Buffer only. No new features. |

Steps 1.1, 1.2, and 1.3 (code only, tested with mocks) can be done **now**, before the API key arrives.
