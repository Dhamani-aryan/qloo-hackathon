# COMMON GROUND
## Research-backed hackathon product and execution plan

**Revision:** 3.0  
**Updated:** October 6, 2026  
**Target:** Qloo Agentic Hackathon 2026  
**Deadline:** October 30, 2026 at 11:45 PM EDT / October 31, 2026 at 9:15 AM IST  
**Status:** Concept revised; live Qloo API spike required before product implementation  
**Implementation guide:** see `IMPLEMENTATION.md` (tracks and steps)

---

# 0. What changed in Revision 3.0

| # | Change | Why |
|---|---|---|
| 1 | **Popularity-adjusted scoring (lift).** Rank by how much *more* each community likes a candidate than the general public does. | Raw bilateral affinity rewards globally popular items, which are exactly the "obvious" bridge. Lift is what makes a bridge *discovered*. |
| 2 | **Concrete entity lineup as the hero output.** Each session is anchored to a specific Qloo entity (film, artist, book, venue) with A-side and B-side supporting seeds. | An abstract brief ("a film-music workshop") is reproducible by an LLM alone. A named, evidenced lineup is not, so Qloo dependence becomes visible. |
| 3 | **Campus ↔ City is the main scenario,** set in a city with strong Qloo coverage (chosen by the spike). Jaipur Craft Futures becomes a conditional backup. | Traditional craft practice is unlikely to resolve to Qloo entities, which would force guessed (stereotyped) seeds. |
| 4 | **Participant taste-intake link.** Organizer shares a URL; each participant adds ~3 favourites; the app aggregates them into the community profile. | Replaces the program director's guesses with real, voluntary signals. Stronger ethics and a stronger demo ("built from 31 participants' own picks"). |
| 5 | **Bridge Potential simplified to three data-backed parts:** bilateral lift, evidence diversity, and a small popularity guard. Activity fit, repeatability, and friction become LLM notes, not weighted numbers. | Arbitrary weights (0.15, 0.10…) look precise but are not defensible in front of judges. |
| 6 | **Evaluation shrunk** to 6 fixed cases, the LLM-only ablation, and ~5 reviewers. | A 10+ evaluator blinded study is unrealistic in 24 days and adds little judging value. |
| 7 | **Single critic pass;** demo time goes to the Obvious vs Discovered reveal. | The reveal is the moment judges remember. |
| 8 | **Sharpened spike question and a pivot rule** (see §18). | One decisive question beats eight open ones. |

---

# 1. Executive decision

Build COMMON GROUND, but narrow it from a general social-cohesion platform into a concrete tool for cultural program designers.

> **COMMON GROUND is an agentic cultural-program designer that uses Qloo to find a non-obvious cultural bridge between two communities and turn it into a realistic recurring program.**

The primary user is a program director at a university, library, museum, cultural centre, NGO, community organization, foundation, or public venue.

Their job is:

> “Help me design a program that two communities would genuinely choose to join—not another generic inclusion event.”

The long-term vision remains social cohesion. The hackathon product makes the narrower, defensible claim that it creates **evidence-backed opportunities for repeated cross-community interaction**.

---

# 2. Product thesis

Most recommendation products ask:

> What will this person like?

COMMON GROUND asks:

> What could two different cultural worlds both enter through, and what could they do there together?

The product optimizes for **bridgeability**, not simple similarity.

## Common ground

An interest already shared directly by both communities.

```text
Community A → cricket ← Community B
```

## Bridging ground

A culturally supported candidate that is attractive to both communities, crosses useful domains, and can become a repeated shared activity.

```text
Community A's confirmed cultural seeds
                    ↓
        Qloo-supported candidate
                    ↑
Community B's confirmed cultural seeds
                    ↓
       recurring shared programme
```

The strongest demonstration will be an **Obvious Bridge vs Discovered Bridge** comparison.

---

# 3. Why this fits the hackathon

The Qloo Agentic Hackathon asks for a working application in which cultural intelligence materially changes an agent’s result. The published judging criteria cover:

1. technological implementation;
2. design;
3. potential impact;
4. quality of the idea.

COMMON GROUND is naturally strong on originality and potential impact. Its main risk is proving that Qloo is indispensable rather than decorative.

The product must show:

- the cultural seeds sent to Qloo;
- the entities and tags resolved by Qloo;
- the domains the agent investigated;
- the Qloo-derived candidate bridges;
- evidence that each candidate connects to both profiles;
- candidates rejected for being one-sided, generic, or impractical;
- how the final program changes when Qloo is removed.

If an LLM-only prompt creates essentially the same result, the implementation has failed.

## Submission requirements

The final submission needs:

- a public, functional end-to-end demo;
- a public source repository;
- a clear product description;
- external hosting rather than local-only access;
- an open-source license visible in the repository About section;
- clean setup instructions;
- known limitations and responsible-use notes.

A demo video is not required. A reliable live application and good screenshots matter more.

---

# 4. What the research changes

## 4.1 Do not assume Qloo exposes arbitrary graph paths

The earlier concept described paths such as:

```text
independent film → Indian cinema → film music → classic cinema
```

This is a useful explanation metaphor, but it must not be presented as a retrieved path unless the API exposes and supports every edge.

The verified Qloo surface is recommendation- and affinity-oriented. Use:

- cross-domain discovery;
- shared-affinity candidate;
- Qloo-supported bridge;
- input contribution;
- evidence chain or query provenance.

Use “multi-hop cultural path” only if live API tests prove it is reproducible.

## 4.2 Use concrete cultural entities, not stereotypes

Profiles should be built from explicit artists, films, shows, books, games, brands, destinations, and places.

Do not begin with assumptions such as “young people like streetwear” or “older people like folk music.” Instead:

1. an organizer supplies cultural seeds;
2. Qloo resolves them;
3. the organizer confirms or corrects every match;
4. analysis uses only confirmed entities and tags.

Natural-language descriptions are acceptable only when the resulting Qloo entities remain visible and editable.

## 4.3 Make the user and decision concrete

The MVP is not a city intelligence dashboard. It helps a cultural-program designer choose:

- a cultural bridge;
- a program format;
- a sequence of activities;
- a venue type;
- partner types;
- accessibility and friction mitigations;
- evidence supporting the choice.

## 4.4 Treat locality as conditional

Qloo supports location-informed insights and heatmaps, but coverage may vary. Jaipur is a candidate demo location, not a fixed technical dependency. Keep it as Qloo-derived locality only if live tests produce specific, useful evidence.

## 4.5 Use one orchestrator

Use one agent orchestrator with deterministic tools and a deterministic bridge engine. The LLM plans, critiques, and synthesizes; it does not calculate affinities or invent cultural relationships.

---

# 5. Evidence behind the social premise

The social premise is credible but must be stated carefully.

Pettigrew and Tropp’s meta-analysis of intergroup contact covered 713 independent samples from 515 studies and found that intergroup contact typically reduced prejudice. This does not prove that a COMMON GROUND program will do so; it supports designing conditions in which constructive contact can occur.

UNESCO describes cultural participation, expression, and access as possible contributors to belonging, inclusion, dialogue, and social cohesion. OECD work distinguishes bonding ties within groups from bridging ties across different groups.

The defensible claim is:

> COMMON GROUND helps organizations design culturally attractive opportunities for repeated, collaborative cross-community contact.

It does not claim:

- that affinity causes social cohesion;
- that an event reduces prejudice;
- that cultural preferences reveal identity;
- that Bridge Potential predicts social impact.

## Intervention implications

Prefer programs with:

- repeated contact instead of a one-off encounter;
- a shared task or creation;
- meaningful roles for both communities;
- voluntary, intrinsically attractive participation;
- balanced agency rather than one group “teaching” the other;
- institutional support and safe facilitation;
- accessible cost, timing, venue, and format.

Penalize passive attendance, tokenism, forced dialogue, and activities attractive to only one side.

---

# 6. Verified Qloo capabilities and constraints

## Core APIs

### Entity Search

```text
GET /search
```

Resolves names to Qloo entity IDs. Search types are not identical to Insights `filter.type` values.

### Tags Search

```text
GET /v2/tags
```

Resolves valid Qloo tags. Free text cannot be used as a tag ID. Semantic tag search is beta and its results require review.

### Insights

```text
GET /v2/insights
```

The primary endpoint for recommendations, affinity-oriented insights, taste analysis, and location-aware results.

Relevant inputs include:

- `filter.type`;
- `signal.interests.entities`;
- `signal.interests.tags`;
- `filter.results.entities` for assessing a shortlist;
- location query or filter parameters where supported;
- `feature.explainability=true` where supported;
- `take`, exclusions, popularity, and type-specific filters.

### Analysis Compare

```text
GET /v2/analysis/compare
```

Compares two entity groups using `a.signal.interests.entities` and `b.signal.interests.entities`, with optional type, location, and model settings. This is promising for bilateral comparison but must be tested with the hackathon credential before becoming a hard dependency.

### Taste Analysis

Using `filter.type=urn:tag`, Insights can return tags associated with entities or locations. This may derive program themes while keeping entity recommendations separate from theme interpretation.

### Location and heatmaps

Qloo can scope recommendations geographically and generate heatmap values including affinity, affinity rank, and popularity. Heatmaps are a stretch feature, not an MVP requirement.

## Output categories

The hackathon guide lists Insights categories including artist, book, brand, destination, movie, person, place, podcast, TV show, and video game. Copy exact URNs from the current hackathon documentation and verify them with the issued credential.

## Important implementation pitfalls

- Music generally maps to artist, not a generic music type.
- Food and dining discovery generally maps to place or brand.
- `/search` types and Insights types differ.
- `/recs` and `/recommendations` are unsupported legacy endpoints.
- The hackathon Insights flow uses GET query parameters.
- The key belongs in `X-Api-Key`, not a bearer token.
- Hackathon keys use `https://hackathon.api.qloo.com`.
- A `200` with empty entities may indicate invalid parameters.
- Invalid parameters may be silently ignored.

## Explainability

The general Insights documentation describes `feature.explainability=true`, returning per-recommendation input contributions and aggregate influence. This is ideal for identifying candidates supported by seeds from both communities.

Validate it against:

- the hackathon environment;
- each selected output type;
- multi-seed profiles;
- combined A+B profiles.

If unavailable, perform separate bilateral validation queries and show query provenance rather than fabricating explanations.

## Official harness

Qloo’s official hackathon kit provides:

- `qloo explore` for investigation;
- `qloo exec` for validated workflows;
- `qloo api` for raw endpoint calls;
- `qloo mcp` for MCP clients.

The kit covers tag finding, entity description, recommendations, comparisons, shortlist ranking, trends, and geographic popularity. Use it during research. Direct server-side REST is likely simplest for a deployed Next.js application; confirm after the spike.

## Security and limits

- Keep the credential server-side.
- Never expose it in a browser, repository, screenshot, prompt, or log.
- Use small bounded requests and bounded retries.
- Cache only what the product needs.
- Do not scrape Qloo or recreate its database.
- Do not send personal identifiers or location histories.

---

# 7. Community profile design

```json
{
  "name": "Young digital creators",
  "description": "A voluntarily described program audience",
  "location": "Jaipur",
  "seeds": [
    {
      "input": "confirmed cultural entity",
      "qlooEntityId": "...",
      "qlooType": "...",
      "confirmedByUser": true
    }
  ]
}
```

## Profile sources (Revision 3.0)

A community profile can come from either of two sources:

1. **Participant intake (preferred).** The organizer creates a session and shares an intake link. Each participant (no account) enters about three favourites across any domains. The app resolves each pick through Qloo search, the participant confirms the match, and the server aggregates confirmed entities into the community seed set, weighted by how many participants named each one. Only entity IDs and counts are stored, with no names, emails, or identifiers.
2. **Organizer-supplied seeds (fallback and prebuilt scenarios).** The organizer enters and confirms seeds directly. Prebuilt demo scenarios load already confirmed.

The UI always shows which source a profile came from and how many contributors it represents.

## MVP rules

- Require 3–8 confirmed seeds per community.
- Encourage at least two cultural domains per profile.
- Show Qloo name, image, type, and description during confirmation.
- Require correction when resolution is ambiguous.
- Offer two prebuilt scenarios for a fast judge experience.
- State that profiles represent supplied aggregate signals, not every member.

---

# 8. Bridge-discovery method

The bridge engine must be reproducible and independent of LLM prose.

## Stage 1: Resolve and verify

1. Search each seed through Qloo.
2. Ask the user to confirm the match.
3. Store its Qloo ID, type, metadata, and provenance.
4. Reject uncertain inputs.

## Stage 2: Expand profiles

For each selected output domain:

1. query Qloo using Community A’s seeds;
2. query Qloo using Community B’s seeds;
3. query Qloo using the combined A+B seed set;
4. request explainability when supported;
5. collect a bounded result set and query metadata.

Initially test movie, artist, TV show, book, place, brand, video game, and destination. Reduce the production set to the 3–5 domains with the best evidence and latency.

## Stage 3: Generate candidates

A candidate enters the pool if:

- it appears in both A and B result sets;
- it appears in the combined result set with meaningful contributions from both groups;
- Analysis Compare supports its relevance to both groups;
- it is a tag/theme independently supported by both profiles.

LLM-only candidates are forbidden.

## Stage 4: Validate bilaterally

For each candidate:

1. retrieve or assess its support against A;
2. retrieve or assess its support against B;
3. capture supporting seeds through explainability or provenance;
4. reject it if one side lacks meaningful support;
5. label evidence as direct, rank-based, tag-based, or location-conditioned.

Where supported, `filter.results.entities` can restrict Insights to the shortlist and evaluate candidates against each profile.

## Stage 5: Normalize safely

Raw scores may not be comparable across output types. Prefer:

1. per-query percentile normalization;
2. reciprocal-rank fusion across queries;
3. numeric affinity only when its semantics are verified as comparable.

Never average unverified scores from different models or categories.

## Stage 5b: Adjust for popularity (lift) — Revision 3.0

The central risk of bilateral intersection is **popularity bias**: items that everyone likes score well with any two profiles, so the "bridge" collapses into the obvious mainstream pick.

For each candidate, compare its support from each community against a **baseline**, meaning its standing for the general public. Possible baselines, in order of preference (confirmed during the spike):

1. Qloo's popularity value on the returned entity;
2. the candidate's rank in a neutral/no-signal Insights query of the same type and location;
3. a `filter.popularity.max` cap or bias setting that excludes the most popular items.

```text
liftA = supportA / baseline     (computed in normalized/percentile space)
liftB = supportB / baseline
```

A candidate is a **discovered bridge** only if both lifts are meaningfully above 1. A candidate with high raw support but low lift is labelled the **obvious bridge** and used in the comparison view.

## Stage 6: Score Bridge Potential (simplified)

```text
BilateralLift = harmonic_mean(liftA, liftB)

BridgePotential =
    0.70 × BilateralLift          (Qloo-derived)
  + 0.20 × EvidenceDiversity      (number of distinct supporting seeds and domains)
  + 0.10 × LocalAvailability      (a verified local venue/entity exists; 0 if unknown)
```

The harmonic mean prevents a candidate loved by one side and ignored by the other from ranking highly. Lift keeps globally popular items from winning by default.

**Activity fit, repeatability, and friction** are no longer weighted numbers. The LLM writes them as short labelled notes on each bridge card, clearly marked as interpretation rather than Qloo data.

Display **Bridge Potential**, never a probability or scientific score.

## Stage 7: Select diverse results

Return three meaningfully different bridges. For each show:

- evidence for A;
- evidence for B;
- supporting Qloo entities/tags;
- evidence type and confidence;
- liftA, liftB, and the popularity baseline used;
- possible activity format (LLM note);
- main friction (LLM note);
- why it beats the obvious alternative.

---

# 9. Agent design

Use one orchestrator with typed tools:

```text
search_qloo_entities()
search_qloo_tags()
expand_profile_by_domain()
compare_profiles()
validate_candidate_for_profile()
get_local_candidates()
rank_bridges()
design_program()
critique_program()
```

## State machine

```text
UNDERSTAND
  → RESOLVE
  → CONFIRM
  → PLAN_DOMAINS
  → QUERY_QLOO
  → GENERATE_CANDIDATES
  → VALIDATE_BILATERALLY
  → SCORE
  → DESIGN
  → CRITIQUE
  → REVISE
  → EXPLAIN
```

## Responsibilities

```text
Qloo
  entities, tags, affinity evidence, comparison, locality

Deterministic bridge engine
  normalization, fusion, validation, scoring, provenance

LLM agent
  query planning, interpretation, intervention design, critique, explanation
```

The LLM receives an evidence ledger and must cite evidence IDs. Remove any unsupported cultural claim before display.

Return “insufficient evidence” instead of manufacturing a bridge when too few seeds resolve, matches are ambiguous, or no candidate has bilateral support.

---

# 10. Intervention design

## Hero output: the entity lineup (Revision 3.0)

The program is built **from Qloo entities**, not abstract themes. Every session is anchored to a specific entity returned by Qloo and shows its evidence:

```text
Session 1 — Screening:      <Qloo movie>     supported by A: <seed>, <seed> · B: <seed>
Session 2 — Listening night: <Qloo artist>   supported by A: <seed> · B: <seed>, <seed>
Session 3 — Shared meal:    <Qloo place near the venue>   (location-conditioned)
Session 4 — Make together:  co-created output inspired by sessions 1–3
```

The LLM chooses the order, format, roles, and facilitation around the lineup, but it **cannot add an entity** that is not in the evidence ledger. Tag/theme results only *label* the lineup ("Coming-of-age soundtracks").

The generator returns structured data:

```text
title
objective
bridge
lineup[]            { session, qlooEntityId, entityName, type, evidenceIds[] }
format
session_count
session_plan
venue_type
partner_types
accessibility
estimated_complexity
friction_mitigations
community_roles
success_measures
evidence_references
limitations
```

## Critic checklist

The critic runs **once**. Its fixes are applied and listed briefly; the demo does not dwell on them.

Reject or revise the program if:

- one community only watches while the other performs;
- participation requires prior expertise;
- it resembles a compulsory diversity seminar;
- the cultural bridge is decorative;
- it is one-off without a good reason;
- cost or venue creates obvious exclusion;
- it is unattractive without the cohesion framing;
- a tradition is flattened, tokenized, or appropriated;
- it claims unsupported outcomes.

---

# 11. Demo scenarios

Do not lock the scenario until live tests are complete.

**Revision 3.0 default:** Campus ↔ City (Candidate B) is the main scenario, set in a city with strong Qloo coverage (for example New York or London; the spike decides). Jaipur Craft Futures is a backup only if the spike shows that its seeds resolve to real Qloo entities without guesswork.

## Candidate A: Jaipur Craft Futures (conditional backup)

**A:** young digital creators, designers, filmmakers, and music-led creators  
**B:** traditional craft practitioners and heritage-oriented participants  
**Objective:** create a recurring collaborative program that respects tradition while enabling contemporary creation

Advantages:

- locally meaningful and visually vivid;
- cross-domain potential;
- naturally collaborative;
- better than a passive “young versus old” framing.

Risk: Qloo may have limited coverage for specific Jaipur craft signals. The profiles must come from explicit seeds, not assumptions.

## Candidate B: Campus ↔ City (main)

**A:** university film/music/creative club represented by confirmed seeds  
**B:** local cultural association represented by confirmed seeds  
**Objective:** connect campus cultural life with the surrounding community through a four-session program

Advantages:

- clear institutional user;
- voluntarily supplied profiles;
- easy to explain and test;
- realistic recurring venue model.

## Candidate C: Newcomers ↔ long-term residents

Use only when both groups explicitly provide their cultural seeds. Do not infer tastes from migration status, ethnicity, language, or age.

## Decision gate

```text
Qloo resolution coverage       25%
bilateral candidate quality    25%
cross-domain richness          15%
locality evidence              10%
intervention clarity           15%
demo appeal                    10%
```

Select one main demo and one backup.

---

# 12. User experience

Build four screens plus one participant page.

## 0. Participant intake page (Revision 3.0)

- reached through a shareable link (`/join/:sessionId/:side`);
- no account; asks for about three favourites across any domain;
- each pick is resolved through Qloo and confirmed by the participant;
- shows a short notice that only aggregate entity counts are stored.

## 1. Define cultural profiles

- select a prebuilt or custom scenario;
- add organization objective and constraints;
- either share intake links for each community or enter 3–8 seeds per community;
- resolve and confirm each seed;
- see the contributor count per profile;
- optionally add location.

## 2. Agent investigation

Show tool actions and concise rationales:

- domains selected;
- Qloo queries completed;
- candidates found and rejected;
- bilateral validation status.

Do not show fake chain-of-thought.

## 3. Compare three bridges

Each card shows Bridge Potential, lift for A and B, the popularity baseline, evidence breadth, locality status, LLM notes (activity fit, friction), and provenance.

Make this the centrepiece:

```text
OBVIOUS BRIDGE
high raw support, low lift: what everyone likes

DISCOVERED BRIDGE
high lift for BOTH communities: what these two groups specifically share
```

## 4. Build the bridge

Generate the four-session **entity lineup** (see §10) with venue type, partner types, balanced community roles, accessibility, success measures, evidence, and limitations.

## Visualization decision

An interactive graph is a stretch feature. Build it only if every edge is traceable to Qloo. A simple provenance view is safer:

```text
A seed ─┐
A seed ─┼─ Qloo candidate ─ program theme
B seed ─┼─ Qloo candidate ─ program theme
B seed ─┘
```

---

# 13. Technical architecture

## Stack

- Next.js and TypeScript;
- React and Tailwind CSS;
- server-side route handlers;
- structured LLM outputs validated with Zod;
- server-only Qloo REST calls;
- Vercel deployment;
- a small key-value store (for example Upstash Redis / Vercel KV) **only** for intake sessions and aggregated entity counts.

Do not add Supabase or accounts; the intake store is the only persistence the MVP needs.

```text
Browser
  ↓
Next.js application
  ↓
Agent orchestrator
  ├── Qloo client
  ├── Bridge engine
  ├── Evidence ledger
  ├── Program generator
  └── Program critic
```

## Suggested endpoints

```text
POST /api/entities/resolve
POST /api/intake/session            create an intake session (two links)
POST /api/intake/:sessionId/:side   submit a participant's confirmed picks
GET  /api/intake/:sessionId         aggregated profile + contributor counts
POST /api/analysis/start
GET  /api/analysis/:id/events
GET  /api/analysis/:id
POST /api/analysis/:id/program
```

## Qloo boundary

```typescript
interface QlooClient {
  searchEntities(input: SearchInput): Promise<EntityMatch[]>;
  searchTags(input: TagSearchInput): Promise<TagMatch[]>;
  getInsights(input: InsightsInput): Promise<InsightsResult>;
  compareProfiles(input: CompareInput): Promise<CompareResult>;
}
```

Normalize raw responses before the bridge engine uses them.

## Evidence ledger

```json
{
  "evidenceId": "ev_123",
  "source": "qloo",
  "endpoint": "/v2/insights",
  "profile": "A",
  "outputType": "urn:entity:movie",
  "candidateId": "...",
  "supportingSeedIds": ["..."],
  "rank": 3,
  "normalizedScore": 0.84,
  "popularityBaseline": 0.41,
  "lift": 2.05,
  "locationConditioned": false,
  "limitations": []
}
```

## Reliability controls

- request timeouts and bounded exponential backoff;
- per-session Qloo call budget;
- schema validation and deduplication;
- server-side cache keyed by normalized request;
- explicit empty and partial-result states;
- fallback from explainability to bilateral queries;
- no fallback from Qloo to invented LLM recommendations.

---

# 14. Evaluation

Evaluate Qloo dependence and product usefulness, not social impact.

## Test set (Revision 3.0: reduced)

Create 6 fixed pairs of confirmed cultural profiles across at least two contexts. Keep one case held out during tuning.

## Conditions

1. **LLM only:** same descriptions and constraints, no Qloo evidence.
2. **Direct overlap:** obvious common categories only.
3. **COMMON GROUND:** Qloo discovery, bilateral validation, scoring, and critique.

## Human evaluation

Present outputs blind and randomized. Score 1–5 on:

- cultural specificity;
- authenticity;
- appeal to A;
- appeal to B;
- actionability;
- novelty without forcedness;
- evidence clarity;
- likelihood of repeated participation.

Also ask: “Which proposal would you actually fund or run, and why?” Aim for about 5 reviewers and report it honestly as informal formative feedback, not a study.

## Technical metrics

- resolution and ambiguity rates;
- percentage of cultural claims with evidence IDs;
- bilateral validation pass rate;
- call count and latency;
- empty and partial-result rate;
- end-to-end time;
- reproducibility for fixed inputs.

## Ablation

Remove Qloo and repeat the fixed cases. Differences should be visible in named entities, cross-domain specificity, bilateral evidence, ranking, and program design. If the result stays essentially the same, revise the product.

---

# 15. Ethics and responsible use

Qloo’s safe-use guidance says aggregate affinities are not evidence of an individual’s identity, sensitive traits, preferences, or future behavior.

COMMON GROUND will:

- use aggregate, organization-supplied, or voluntarily supplied seeds;
- avoid personal identifiers and location histories;
- never infer religion, race, ethnicity, politics, sexuality, health, migration, or financial status;
- never use results for high-impact eligibility decisions;
- distinguish Qloo results from heuristics and interpretation;
- show uncertainty and limitations;
- allow profile correction;
- avoid individual targeting and manipulation;
- refuse political persuasion;
- avoid causal claims.

Both communities should have agency in defining profiles and reviewing the final program. Generated plans are drafts for participatory refinement, not instructions imposed on communities.

---

# 16. Scope

## Must ship

- two editable, Qloo-resolved profiles;
- one reliable main scenario (Campus ↔ City) and one backup;
- server-side Qloo integration;
- cross-domain discovery and bilateral validation;
- popularity-adjusted lift scoring;
- transparent, simplified Bridge Potential;
- three bridge results;
- Obvious vs Discovered comparison;
- one generated and critiqued recurring program built as a Qloo entity lineup;
- evidence provenance;
- LLM-only comparison;
- public deployment, repository, and license;
- evaluation and known limitations.

## Should ship

- participant taste-intake link with aggregated profiles;
- streaming investigation status;
- exportable brief;
- location-conditioned place suggestions when supported;
- caching for reliable prebuilt scenarios;
- basic feedback capture.

## Stretch

- interactive graph;
- heatmap;
- citywide connectivity view;
- accounts and saved workspaces;
- longitudinal measurement.

## Out of scope

- political analysis;
- individual matching;
- sensitive-attribute inference;
- a social network;
- a global cultural map;
- scientific cohesion claims;
- complex multi-agent architecture;
- unsupported graph edges.

---

# 17. Execution calendar

> **Revision 3.0 note:** the spike slipped because the API key requires an approved project form. The day-by-day mapping to tracks lives in `IMPLEMENTATION.md`. Dates below remain the target where still possible; the spike now runs as soon as the key arrives and must finish within two days of it.

## October 4–6 (slipped → key arrival + 2 days): Access and API spike

- Request or confirm the hackathon key.
- Install the official Qloo harness 0.1.26 or newer for exploration.
- Test search, tags, Insights, and Analysis Compare.
- Test explainability, shortlist filtering, and location.
- Resolve at least 30 candidate seeds.
- Run at least 20 controlled requests across the two leading scenarios.
- Record response shapes, numeric semantics, supported parameters, empty results, latency, and errors.
- Create sanitized fixtures for tests.

**Gate:** do not build the polished UI until one scenario yields at least three defensible bilateral candidates.

## October 7: Decision day

- Score and select the main scenario and backup.
- Choose direct REST or harness-backed deployment.
- Freeze supported domains, evidence schema, and scoring semantics.

## October 8–12: Bridge engine

- Build resolution and confirmation.
- Build the typed Qloo client.
- Implement bounded expansion, candidate generation, bilateral validation, normalization, and ranking.
- Produce deterministic ranked JSON from a CLI or test page.

**Gate:** every ranked candidate must link to stored Qloo evidence.

## October 13–17: Agent and vertical slice

- Add structured agent planning.
- Add the program schema, critic, and revision.
- Build the four-screen interface.
- Add empty, partial, and error states.
- Deploy the first complete vertical slice by October 17.

## October 18–21: Evaluation

- Build LLM-only and direct-overlap baselines.
- Run the fixed test set and blinded human evaluation.
- Tune without touching held-out cases.

## October 22–25: Reliability and design

- Improve the evidence and comparison views.
- Add caching, budgets, timeouts, retries, and rate limiting.
- Test incognito, mobile, slow network, invalid key, and empty results.
- Remove decorative complexity and unsupported claims.

## October 26–28: Submission package

- Publish the repository and OSI-compatible license.
- Add setup, architecture, redacted examples, screenshots, evaluation, limitations, and responsible-use notes.
- Confirm no secrets or personal data appear in Git history.

## October 29: Submission target

- Test from an unrelated device/account.
- Verify all public URLs.
- Submit, keeping the official deadline as emergency buffer.

## October 30: Buffer only

Fix blocking issues. Add no new features.

---

# 18. API-spike test matrix

| Test | Question |
|---|---|
| Search resolution | Do intended seeds resolve correctly? |
| A-only Insights | What does Profile A produce? |
| B-only Insights | What does Profile B produce? |
| Combined Insights | Are bilateral candidates produced? |
| Explainability | Can contributions be attributed to both sides? |
| Shortlist validation | Can a candidate be assessed with `filter.results.entities`? |
| Analysis Compare | Does comparison add usable evidence? |
| Taste Analysis | Do tags create credible program themes? |
| Location | Does Jaipur materially improve relevance? |
| Failure behavior | What happens with invalid or sparse inputs? |
| Latency | Is the call fast enough for a judge? |

## The decisive question (Revision 3.0)

> **After popularity adjustment, does Campus ↔ City produce at least three bilateral candidates that a human would call non-obvious?**

- **Yes →** continue with COMMON GROUND as planned.
- **No, but raw bilateral candidates exist →** try other popularity baselines and domains for one more day.
- **Still no →** pivot the same engine to small groups (2–6 people: friends, couples, families planning an outing). Qloo data is stronger at that scale and almost all code is reused.

Required answers before final implementation:

0. Which popularity baseline works (entity popularity field, neutral-query rank, or popularity filter)?
1. What numeric fields are returned and what do they mean?
2. Are scores comparable across queries or only within a ranking?
3. Does explainability work in the hackathon environment?
4. What does Analysis Compare return for two multi-entity groups?
5. Which output types consistently work?
6. Is Jaipur location coverage useful?
7. What is the smallest call set that yields three good bridges?
8. What are the observed limits and latency?

---

# 19. Three-minute demo

## 0:00–0:25 — Problem

> Program directors are asked to bring communities together, but generic AI gives generic events because it does not know which cultural ideas are genuinely attractive to both groups.

## 0:25–0:50 — Profiles

Open the prebuilt scenario. Show confirmed Qloo entities for both communities and the contributor count from participant intake.

## 0:50–1:15 — Investigation

Run the agent. Show selected domains, Qloo calls, candidates, rejections, and bilateral validation.

## 1:15–2:00 — Reveal (the centrepiece)

Compare the obvious bridge (high raw support, low lift) with the top discovered bridge (high lift for both). Show evidence from both communities.

## 2:00–2:35 — Build

Show the four-session entity lineup: named films, artists, and a local venue, each with A-side and B-side supporting seeds. Mention the critic's fixes in one line.

## 2:35–3:00 — Prove dependence

Show the LLM-only result next to COMMON GROUND. Highlight the specific entities, ranking, and program decisions that disappear without Qloo.

Close with:

> We have spent decades building systems that learn what each person likes. COMMON GROUND uses cultural intelligence to discover what different people might genuinely want to do together.

---

# 20. Submission copy

## One sentence

COMMON GROUND uses Qloo’s cultural intelligence to help program directors find an evidence-backed bridge between two communities and turn it into a recurring shared experience.

## Short description

Generic AI can propose workshops, festivals, or community dinners, but it cannot reliably know which cultural ideas will feel authentic to two different groups. COMMON GROUND begins with cultural entities confirmed by the communities or their organizers. An agent investigates multiple Qloo domains, validates candidate bridges against both profiles, rejects one-sided or generic results, and designs a practical recurring program around the strongest bridge. Every cultural claim links to Qloo evidence, and an LLM-only comparison makes Qloo’s contribution visible.

## Differentiator

```text
Recommendation systems optimize individual similarity.
COMMON GROUND optimizes bilateral bridgeability.
```

## Honest limitation

COMMON GROUND does not predict whether a program will reduce prejudice or improve social cohesion. It produces a culturally grounded program hypothesis that should be reviewed and co-designed with participating communities.

---

# 21. Definition of done

The MVP is complete only when a judge can:

1. open the public app without an account;
2. load a polished scenario;
3. inspect and edit both profiles;
4. see Qloo resolve the seeds;
5. run the agent end-to-end;
6. see investigated domains;
7. compare three bilaterally validated bridges;
8. inspect provenance for every cultural claim;
9. understand why the winner beats the obvious bridge;
10. generate a realistic repeated program;
11. see the critic improve it;
12. compare it with an LLM-only baseline;
13. get a graceful “insufficient evidence” result when appropriate;
14. inspect a public repo with setup, license, architecture, evaluation, and limitations;
15. understand within three minutes why the product is worse without Qloo.

---

# 22. Immediate actions

1. Submit the project form and obtain the hackathon key.
2. Keep it outside the repository and browser (`.env.local`, git-ignored).
3. Install the official harness for exploration.
4. Build a small API-spike script before the UI.
5. Test Campus ↔ City first, then the backup.
6. Validate the popularity baseline, explainability, compare, shortlist filtering, and location.
7. Answer the decisive question (§18) and choose the demo from evidence.
8. Freeze the evidence schema.
9. Build the deterministic bridge engine.
10. Then build the agent and polished interface.

The highest-priority milestone is:

> **Produce three defensible, popularity-adjusted bilateral bridge candidates from live Qloo responses before investing in visual polish.**

---

# 23. Sources

## Hackathon and Qloo

- Qloo Agentic Hackathon and judging criteria: https://qloo.devpost.com/
- Schedule: https://qloo.devpost.com/details/dates
- Hackathon developer guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
- API overview: https://docs.qloo.com/reference/api-overview
- Insights deep dive: https://docs.qloo.com/reference/insights-api-deep-dive
- Entity type parameter guide: https://docs.qloo.com/reference/available-parameters-by-entity-type
- Analysis Compare: https://docs.qloo.com/reference/analysis-compare
- Location-based Insights: https://docs.qloo.com/reference/insights-with-location-use-case
- Taste Analysis: https://docs.qloo.com/reference/taste-analysis
- Search Entities: https://docs.qloo.com/reference/get-search
- Search Tags: https://docs.qloo.com/reference/search-tags
- Official hackathon kit: https://github.com/qloo/qloo-hackathon-kit
- API access and limits: https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/API_ACCESS.md
- Safe use: https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SAFE_USE.md
- Submission guide: https://github.com/qloo/qloo-hackathon-kit/blob/main/docs/SUBMISSION.md

## Social and cultural foundation

- Pettigrew & Tropp, intergroup contact meta-analysis: https://pubmed.ncbi.nlm.nih.gov/16737372/
- UNESCO, culture and social inclusion: https://www.unesco.org/en/articles/tracker-culture-public-policy-focus-culture-and-social-inclusion
- UNESCO, measuring cultural participation: https://uis.unesco.org/sites/default/files/documents/measuring-cultural-participation-2009-unesco-framework-for-cultural-statistics-handbook-2-2012-en.pdf
- OECD, *The Well-being of Nations*: https://www.oecd.org/content/dam/oecd/en/publications/reports/2001/05/the-well-being-of-nations_g1gh268d/9789264189515-en.pdf
- OECD, *Reconnecting society through culture*: https://www.oecd.org/en/events/2024/07/reconnecting-society-through-culture-uniting-people-places-and-communities-in-a-polarised-world.html

---

# 24. Final thesis

> **We have spent decades building algorithms that learn what people like. What if cultural intelligence could help us discover what different people might genuinely want to do together?**

Qloo supplies the cultural evidence. The bridge engine supplies transparent bilateral reasoning. The agent turns the strongest bridge into a realistic shared program.

That is COMMON GROUND.
