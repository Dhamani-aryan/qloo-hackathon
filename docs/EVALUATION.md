# Evaluation (step 5.3)

**Run:** 2026-10-18 · **Cases:** 16 (1 held out) · **Mode:** every case live (Qloo + LLM, no cache)

This is a **formative** evaluation: six fixed scenarios plus variants with notes, settings and stress conditions (mismatched groups, sparse profiles, non-Latin titles, a smaller city), technical metrics, deterministic checks, the agent's own decisions, and a with/without-Qloo ablation. It does **not** measure social impact, and the seeds are hypothetical test inputs, not real communities. Human ratings are collected separately (see "Human review" below).

Reproduce it with `npm run spike eval/run.ts`, then `npm run spike eval/report.ts`. Raw outputs stay in the git-ignored `eval/out/`.

## Conditions compared

| Condition | What it is |
|---|---|
| **LLM only** | The same objective, group labels and favourite *names* go to the same model, with no Qloo data (`src/lib/agent/baseline.ts`). |
| **Obvious pick** | The candidate with the strongest raw support from both groups, which is mainstream by construction: what a "most popular overlap" approach would choose. |
| **Common Ground** | The full system: Qloo discovery, per-group validation, popularity adjustment, an agent review that can search further with tools, an entity-anchored plan, a critic pass, and invitations. |

## Technical metrics

| Metric | Result |
|---|---|
| Runs completing with a plan | 16 / 16 |
| Seeds resolved to a Qloo entity | 100% (136 exact, 14 flagged for a human check, 0 not found) |
| Mean end-to-end time (live) | 102 s |
| Mean Qloo calls per run | 25.6 |
| Candidates considered per run (mean) | 239 |
| Candidates failing the two-sided test | 68% of all candidates |
| Plan sessions anchored to a Qloo entity | 92% (59 / 64; the rest are co-creation sessions) |
| Unverified references removed by the evidence guard | 2 |
| Every shown bridge at or above the 50th percentile for both groups | Yes (lowest: 50th) |
| Same top-3 bridges on an immediate rerun of the engine (including the agent's extra searches) | 16 / 16 |
| Mean popularity of the obvious pick vs the chosen bridges | 98 vs 74 (percentile) |

**Rejections across all runs:** 2132 one-sided · 464 weak on both · 195 sensitive topic · 141 unsuitable venue · 80 mature content (under-18 group) · 16 too niche · 6 bundle or box set · 3 named like the city.

**What the critic fixed most often:** generic roles (13), cost or access (4), organizer rules (3), decorative bridge (2), unsupported claims (1).

## Ablation: with vs without Qloo

| | Common Ground | LLM only |
|---|---|---|
| Plan anchors that are new titles **backed by both groups' Qloo data** | **58** | 0 |
| Titles that just **reuse the favourites** it was given | — | 148 of 188 named |
| **Unverified** titles (named without any evidence) | 0 | 40 of 188 named |
| Evidence citations | 257 | 0 |

These counts show **provenance** (where each named title came from), not that the plans are better. The model-only version gets the same favourites, notes and settings. Whether organizers prefer either is a human judgment that is still pending.

## Per case

| Case | City | Status | Top bridges (support A / B · popularity) | Obvious pick (popularity) | Ablation: Qloo-found vs LLM reused / unverified |
|---|---|---|---|---|---|
| University ↔ neighbourhood | New York City | ok | Somebody Somewhere (96/100 · 79); High Fidelity (100/72 · 90); Royal Tenenbaums House (88/90 · 83) | Fleishman Is in Trouble (92) | 4 vs 12 / 1 |
| Youth culture ↔ older enthusiasts | London | ok | Rain Dogs (69/100 · 49); High Fidelity (100/65 · 90); 221B Baker St (79/68 · 79) | Abbey Road Studios (100) | 4 vs 10 / 2 |
| Hobby groups | Chicago | ok | Norse Mythology (81/53 · 89); TOEM (60/67 · 88); Dreamboy (62/55 · 90) | Cloud Gate (100) | 4 vs 10 / 0 |
| Contemporary ↔ classical | Mumbai | ok | The Mindvalley Podcast with Vishen (86/93 · 74); The New Classmate (84/79 · 84); Jamtara: Sabka Number Ayega (77/85 · 81) | On Purpose with Jay Shetty (99) | 4 vs 10 / 0 |
| Nightlife ↔ performing arts | Berlin | ok | Moab Is My Washpot (83/94 · 40); David Hasselhoff Museum (88/97 · 79); Here and Now (77/73 · 70) | East Side Gallery (100) | 4 vs 10 / 0 |
| Dance crew ↔ community choir *(held out)* | Toronto | ok | Fight for My Way (72/97 · 85); Sex Education: The Road Trip (53/67 · 53); Over The Rainbow (55/90 · 77) | Little Women (100) | 4 vs 8 / 6 |
| Hobby groups, with notes | Chicago | ok | Norse Mythology (81/53 · 89); TOEM (60/67 · 88); NiNoKuni (55/59 · 83) | Cloud Gate (100) | 4 vs 10 / 0 |
| Youth culture ↔ older enthusiasts, with notes | London | ok | Rain Dogs (69/100 · 49); High Fidelity (100/65 · 90); 221B Baker St (90/80 · 79) | Abbey Road Studios (100) | 4 vs 10 / 7 |
| Mismatched groups | Oslo | ok | Sub Scene (69/94 · 73) | Neseblod Records (95) | 1 vs 6 / 8 |
| Sparse profiles | Lisbon | ok | Mafalda Arnauth (80/77 · 88); Gabriel and the Mountain (74/81 · 65); Run (50/86 · 53) | Fresh Air (99) | 3 vs 6 / 6 |
| University ↔ neighbourhood, familiar picks | New York City | ok | Somebody Somewhere (96/100 · 79); Weyes Blood (98/75 · 99); Song Exploder (90/90 · 98) | Fleishman Is in Trouble (92) | 4 vs 12 / 0 |
| University ↔ neighbourhood, exploratory picks | New York City | ok | Somebody Somewhere (96/100 · 79); Here and Now (60/92 · 70); Cannoli King (90/78 · 68) | Fleishman Is in Trouble (92) | 4 vs 12 / 6 |
| Hobby groups, all ages | Chicago | ok | TOEM (60/67 · 88); Chicago Line Cruises (73/87 · 89); Norse Mythology (81/53 · 89) | Cloud Gate (100) | 4 vs 10 / 0 |
| Nightlife ↔ performing arts, free at an existing venue | Berlin | ok | Moab Is My Washpot (83/94 · 40); Here and Now (77/73 · 70); Unmade Beds (51/91 · 65) | East Side Gallery (100) | 4 vs 10 / 0 |
| Non-Latin titles | Seoul | ok | Strong Girl Bong-soon (88/75 · 84); PENTAGON's Jack Pod (80/65 · 35); Jannabi (73/60 · 87) | A Silent Voice: The Movie (99) | 3 vs 6 / 2 |
| Smaller, less-covered city | Tartu | ok | Quirke (75/79 · 43); Anne kanal (100/100 · 61); Antoniuse Õu (95/70 · 34) | Tartu Ülikooli Kliinikum SA Südamekliinik (92) | 3 vs 6 / 2 |

## The agent at work

After the first Qloo pass the agent reviews the evidence. With three strong bridges and no notes it stops; otherwise it may run up to two extra searches with its tools: **explore another kind of culture** (films, video games) or **look for places on a theme** (a Qloo place tag such as "Jazz club"). Everything it finds is scored by the same deterministic engine, and it keeps the extra results only if they beat the earlier ones.

| Case | Extra search rounds | Kinds it added | Place themes searched | Decisions logged |
|---|---|---|---|---|
| University ↔ neighbourhood | 0 | — | — | 2 |
| Youth culture ↔ older enthusiasts | 0 | — | — | 2 |
| Hobby groups | 0 | — | — | 2 |
| Contemporary ↔ classical | 0 | — | — | 2 |
| Nightlife ↔ performing arts | 0 | — | — | 2 |
| Dance crew ↔ community choir | 0 | — | — | 2 |
| Hobby groups, with notes | 0 | — | — | 3 |
| Youth culture ↔ older enthusiasts, with notes | 1 | — | Jazz club, Live music venue | 10 |
| Mismatched groups | 1 | — | — | 5 |
| Sparse profiles | 0 | — | — | 2 |
| University ↔ neighbourhood, familiar picks | 0 | — | — | 2 |
| University ↔ neighbourhood, exploratory picks | 0 | — | — | 2 |
| Hobby groups, all ages | 0 | — | — | 2 |
| Nightlife ↔ performing arts, free at an existing venue | 0 | — | — | 2 |
| Non-Latin titles | 0 | — | — | 2 |
| Smaller, less-covered city | 0 | — | — | 2 |

### Automated checks: notes, settings and stress cases

Each check is verified in code against the run's output (not judged by a model): **27 / 27 passed** across 16 cases. Failures are listed, not hidden.

- **University ↔ neighbourhood:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Youth culture ↔ older enthusiasts:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Hobby groups:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Contemporary ↔ classical:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Nightlife ↔ performing arts:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Dance crew ↔ community choir:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Hobby groups, with notes:** "Some members are 14 to 17. No podcasts please, and every session must be free."
  - ✓ no podcast searched or suggested
  - ✓ treated as an under-18 group (mature filter on)
  - ✓ nothing tagged Mature suggested
  - ✓ every plan anchor is a strong bridge or strong alternative
  - ✓ notes understood (turned into settings the agent applied)
- **Youth culture ↔ older enthusiasts, with notes:** "Adults only. We'd love it to centre on a live jazz venue in the city."
  - ✓ searched jazz places
  - ✓ every plan anchor is a strong bridge or strong alternative
  - ✓ notes understood (turned into settings the agent applied)
- **Mismatched groups:** "(default settings)"
  - ✓ flags weak overlap or returns insufficient evidence (no filler)
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Sparse profiles:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **University ↔ neighbourhood, familiar picks:** "novelty: familiar"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **University ↔ neighbourhood, exploratory picks:** "novelty: exploratory"
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Hobby groups, all ages:** "audience: all_ages, activity: play"
  - ✓ treated as an under-18 group (mature filter on)
  - ✓ nothing tagged Mature suggested
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Nightlife ↔ performing arts, free at an existing venue:** "venue: existing, venueName: Community library hall, budget: free, groupSize: 24, access: step-free access, captions"
  - ✓ no session sends people to a recommended place
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Non-Latin titles:** "(default settings)"
  - ✓ every non-Latin favourite resolved
  - ✓ every plan anchor is a strong bridge or strong alternative
- **Smaller, less-covered city:** "(default settings)"
  - ✓ every plan anchor is a strong bridge or strong alternative


### Discovery preference

Same New York groups, two settings. Mean bridge popularity: **familiar 92** vs **exploratory 73** (percentile), so the setting moves picks in the intended direction.

## What earlier runs found, and what changed

**Run 1 → content rules.** Four bridges were unsuitable for a community program. They were fixed with responsible-use rules, not score tuning (`src/lib/engine/filters.ts`). One came from the held-out case; the fix is a venue-type rule, not a threshold change.

**Run 2 → accuracy changes.** Two issues made results less trustworthy:
- *Repeatability:* the LLM planner picked different categories on different runs, so the same input could give different bridges (Berlin). Every proven category now always runs, and films only when a group named a film.
- *Weak third bridges:* some bridges passed at about the 51st percentile for both groups (Toronto). Only bridges with solid support from both groups (harmonic mean ≥ 0.55) are shown now; weaker ones move to "also in the running".

**Run 8 → stress cases under the revised scoring.** Organizer settings now change scoring (familiar picks averaged the 92nd popularity percentile vs 73rd for exploratory), and eight stress cases were added. Findings: a kids' TV group and a death-metal group got filler "bridges" at the 50th–64th percentile, because percentiles are relative to the pool; when Qloo's Compare finds no shared theme, a stricter bar (65th for both) now applies and the page warns, leaving one bridge. Two Tartu high schools appeared as bridges and a cardiology clinic as the mainstream contrast; K-12 schools, childcare and medical facilities are now excluded as venues (rerun: a canal and an artisan courtyard). Non-Latin titles (Korean, Japanese) all resolved.

**Run 6 → following notes.** With "adults only, a live jazz venue", the agent searched Qloo's *Jazz club* tag, but every club was rejected as a bar by the mixed-age alcohol rule. Bars and clubs are now allowed when the organizer says the group is adults only (hotels, worship and government buildings stay out). In run 7 the clubs were scored properly and still didn't qualify: the skate collective's support for Ronnie Scott's is only around the 20th percentile. The agent now says exactly that in its log instead of forcing a one-sided pick.

**Run 5 → stricter bridges.** Some third bridges had one group in the 40s (Yola at 44th, *Watership Down* at 41st, *The Beatles: Get Back* at 49th), which reads as "one group doesn't really like it". Every shown bridge now needs at least the 50th percentile from **both** groups. All six cases still show three bridges: the next strong candidate takes the slot (for example Royal Tenenbaums House at 88/90 in New York).

**Run 4 → robustness.** Run 4 gave the same bridges as run 3 in every case but one. In New York, Qloo rate-limited (429) one scoring call while another client was using the key. The engine read the missing scores as "no support" and silently dropped every place, including the top bridge. Now every busy Qloo call is retried after a pause; a call that still fails leaves its domain out (marked "not scored") rather than misjudging it; such runs are never cached and the page says so. Rerun alone, New York gave its usual bridges again.

| Problem in run 1 | Case | Rule added |
|---|---|---|
| Palace of Westminster (Parliament) | London | Government buildings are not venues |
| A café named "Chicago" | Chicago | Places named just like the city are skipped (confusing in a plan) |
| A "Collection 6 Books Set" listing | Chicago | Bundles and box sets are not single works |
| A sake brewery | Toronto *(held out)* | Alcohol-centred venues are excluded (mixed groups may include under-21s) |

| Case | Run 1 bridges | Latest bridges |
|---|---|---|
| University ↔ neighbourhood | Cannoli King; Somebody Somewhere; Yola | Somebody Somewhere; High Fidelity; Royal Tenenbaums House |
| Youth culture ↔ older enthusiasts | Rain Dogs; Palace of Westminster; 221B Baker St | Rain Dogs; High Fidelity; 221B Baker St |
| Hobby groups | Chicago; Ôoku: The Inner Chambers; Alice Oseman Collection 6 Books Set (Solitaire, Loveless, This Winter, Radio Silence, Nick and Charlie, I Was Born for This) | Norse Mythology; TOEM; Dreamboy |
| Contemporary ↔ classical | Pearl Academy; Jamtara: Sabka Number Ayega; The New Classmate | The Mindvalley Podcast with Vishen; The New Classmate; Jamtara: Sabka Number Ayega |
| Nightlife ↔ performing arts | David Hasselhoff Museum; Here and Now; What Remains | Moab Is My Washpot; David Hasselhoff Museum; Here and Now |
| Dance crew ↔ community choir | IZUMI Brewery (Ontario Spring Water Sake Company); Are You Human Too?; DAWN 던 | Fight for My Way; Sex Education: The Road Trip; Over The Rainbow |
| Hobby groups, with notes | — | Norse Mythology; TOEM; NiNoKuni |
| Youth culture ↔ older enthusiasts, with notes | — | Rain Dogs; High Fidelity; 221B Baker St |
| Mismatched groups | — | Sub Scene |
| Sparse profiles | — | Mafalda Arnauth; Gabriel and the Mountain; Run |
| University ↔ neighbourhood, familiar picks | — | Somebody Somewhere; Weyes Blood; Song Exploder |
| University ↔ neighbourhood, exploratory picks | — | Somebody Somewhere; Here and Now; Cannoli King |
| Hobby groups, all ages | — | TOEM; Chicago Line Cruises; Norse Mythology |
| Nightlife ↔ performing arts, free at an existing venue | — | Moab Is My Washpot; Here and Now; Unmade Beds |
| Non-Latin titles | — | Strong Girl Bong-soon; PENTAGON's Jack Pod; Jannabi |
| Smaller, less-covered city | — | Quirke; Anne kanal; Antoniuse Õu |

## Human review

Running the evaluation writes one **blind packet** per case to `eval/out/packets/`. Each has two unlabelled plans (Common Ground and LLM only, in random order), a 1–5 rating form on seven criteria (cultural specificity, authenticity, appeal to each group, actionability, novelty without forcedness, likelihood of repeat attendance), and "which would you fund or run, and why?". The answer key is in `*.key.json`.

**Status:** pending. No real organizers have rated the proposals yet, so nothing here shows that people prefer them. The target is about 5 reviewers; results will be reported as informal feedback, not as a study.

## Limitations

- The seeds are plausible but **hypothetical**. Real profiles would come from participant intake.
- There are six base cases plus note variants, one run each. The LLM steps are non-deterministic; only the Qloo engine is reproducible.
- Bridges are only as good as Qloo's data for each group. For example, Mumbai's profiles surface a self-help podcast as a bridge, which is supported by both sides but may not suit every organizer.
- Bridge Potential is a transparent ranking score, not a probability, and **nothing here measures social cohesion**.
- Thresholds (40th-percentile floor for candidates, 50th for shown bridges, popularity band 0.3–0.9) were set on the New York spike scenario and the run 1–4 findings. Five of these cases, including the held-out one, were not used for tuning.
