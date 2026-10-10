# Evaluation (step 5.3)

**Run:** 2026-10-10 · **Cases:** 6 (1 held out) · **Mode:** every case live (Qloo + LLM, no cache)

This is a **formative** evaluation: six fixed scenarios, technical metrics, and a with/without-Qloo ablation. It does **not** measure social impact, and the seeds are hypothetical test inputs, not real communities. Human ratings are collected separately (see "Human review" below).

Reproduce it with `npm run spike eval/run.ts`, then `npm run spike eval/report.ts`. Raw outputs stay in the git-ignored `eval/out/`.

## Conditions compared

| Condition | What it is |
|---|---|
| **LLM only** | The same objective, group labels and favourite *names* go to the same model, with no Qloo data (`src/lib/agent/baseline.ts`). |
| **Obvious pick** | The candidate with the strongest raw support from both groups, which is mainstream by construction: what a "most popular overlap" approach would choose. |
| **Common Ground** | The full system: Qloo discovery, per-group validation, popularity adjustment, an entity-anchored plan, and a critic pass. |

## Technical metrics

| Metric | Result |
|---|---|
| Runs completing with a plan | 6 / 6 |
| Seeds resolved to a Qloo entity | 100% (53 exact, 9 flagged for a human check, 0 not found) |
| Mean end-to-end time (live) | 71 s |
| Mean Qloo calls per run | 25.0 |
| Candidates considered per run (mean) | 238 |
| Candidates failing the two-sided test | 67% of all candidates |
| Plan sessions anchored to a Qloo entity | 83% (20 / 24; the rest are co-creation sessions) |
| Unverified references removed by the evidence guard | 0 |
| Same top-3 bridges on an immediate rerun of the engine | 6 / 6 |
| Mean popularity of the obvious pick vs the chosen bridges | 99 vs 73 (percentile) |

**Rejections across all runs:** 764 one-sided · 190 weak on both · 91 sensitive topic · 48 unsuitable venue · 3 too niche · 2 bundle or box set · 1 named like the city.

**What the critic fixed most often:** generic roles (6), cost or access (2), expertise barrier (1).

## Ablation: with vs without Qloo

| | Common Ground | LLM only |
|---|---|---|
| Plan anchors that are new titles **backed by both groups' Qloo data** | **20** | 0 |
| Titles that just **reuse the favourites** it was given | — | 49 of 71 named |
| **Unverified** titles (named without any evidence) | 0 | 22 of 71 named |
| Evidence citations | 95 | 0 |

## Per case

| Case | City | Status | Top bridges (support A / B · popularity) | Obvious pick (popularity) | Ablation: Qloo-found vs LLM reused / unverified |
|---|---|---|---|---|---|
| University ↔ neighbourhood | New York City | ok | Cannoli King (90/78 · 68); Somebody Somewhere (96/100 · 79); Yola (44/81 · 89) | Fleishman Is in Trouble (92) | 4 vs 5 / 5 |
| Youth culture ↔ older enthusiasts | London | ok | Rain Dogs (69/100 · 49); 221B Baker St (79/68 · 79); High Fidelity (100/65 · 90) | Abbey Road Studios (100) | 4 vs 7 / 9 |
| Hobby groups | Chicago | ok | Gallagher House (100/60 · 79); Norse Mythology (81/53 · 89); Watership Down (97/41 · 86) | Cloud Gate (100) | 3 vs 9 / 4 |
| Contemporary ↔ classical | Mumbai | ok | Pearl Academy (96/83 · 77); The Mindvalley Podcast with Vishen (86/93 · 74); Jamtara: Sabka Number Ayega (77/85 · 81) | On Purpose with Jay Shetty (99) | 3 vs 9 / 1 |
| Nightlife ↔ performing arts | Berlin | ok | Moab Is My Washpot (83/94 · 40); David Hasselhoff Museum (88/97 · 79); Here and Now (77/73 · 70) | East Side Gallery (100) | 3 vs 9 / 1 |
| Dance crew ↔ community choir *(held out)* | Toronto | ok | The Beatles: Get Back (49/79 · 40); Over The Rainbow (55/90 · 77); Are You Human Too? (50/81 · 59) | Little Women (100) | 3 vs 10 / 2 |

## What earlier runs found, and what changed

**Run 1 → content rules.** Four bridges were unsuitable for a community program. They were fixed with responsible-use rules, not score tuning (`src/lib/engine/filters.ts`). One came from the held-out case; the fix is a venue-type rule, not a threshold change.

**Run 2 → accuracy changes.** Two issues made results less trustworthy:
- *Repeatability:* the LLM planner picked different categories on different runs, so the same input could give different bridges (Berlin). Every proven category now always runs, and films only when a group named a film.
- *Weak third bridges:* some bridges passed at about the 51st percentile for both groups (Toronto). Only bridges with solid support from both groups (harmonic mean ≥ 0.55) are shown now; weaker ones move to "also in the running".

| Problem in run 1 | Case | Rule added |
|---|---|---|
| Palace of Westminster (Parliament) | London | Government buildings are not venues |
| A café named "Chicago" | Chicago | Places named just like the city are skipped (confusing in a plan) |
| A "Collection 6 Books Set" listing | Chicago | Bundles and box sets are not single works |
| A sake brewery | Toronto *(held out)* | Alcohol-centred venues are excluded (mixed groups may include under-21s) |

| Case | Run 1 bridges | Latest bridges |
|---|---|---|
| University ↔ neighbourhood | Cannoli King; Somebody Somewhere; Yola | Cannoli King; Somebody Somewhere; Yola |
| Youth culture ↔ older enthusiasts | Rain Dogs; Palace of Westminster; 221B Baker St | Rain Dogs; 221B Baker St; High Fidelity |
| Hobby groups | Chicago; Ôoku: The Inner Chambers; Alice Oseman Collection 6 Books Set (Solitaire, Loveless, This Winter, Radio Silence, Nick and Charlie, I Was Born for This) | Gallagher House; Norse Mythology; Watership Down |
| Contemporary ↔ classical | Pearl Academy; Jamtara: Sabka Number Ayega; The New Classmate | Pearl Academy; The Mindvalley Podcast with Vishen; Jamtara: Sabka Number Ayega |
| Nightlife ↔ performing arts | David Hasselhoff Museum; Here and Now; What Remains | Moab Is My Washpot; David Hasselhoff Museum; Here and Now |
| Dance crew ↔ community choir | IZUMI Brewery (Ontario Spring Water Sake Company); Are You Human Too?; DAWN 던 | The Beatles: Get Back; Over The Rainbow; Are You Human Too? |

## Human review

Running the evaluation writes one **blind packet** per case to `eval/out/packets/`. Each has two unlabelled plans (Common Ground and LLM only, in random order), a 1–5 rating form on seven criteria (cultural specificity, authenticity, appeal to each group, actionability, novelty without forcedness, likelihood of repeat attendance), and "which would you fund or run, and why?". The answer key is in `*.key.json`.

**Status:** pending. The target is about 5 reviewers. Results will be reported here honestly as informal feedback, not as a study.

## Limitations

- The seeds are plausible but **hypothetical**. Real profiles would come from participant intake.
- There are six cases, one run each. The LLM steps are non-deterministic; only the Qloo engine is reproducible.
- Bridges are only as good as Qloo's data for each group. For example, Mumbai's profiles surface a self-help podcast as a bridge, which is supported by both sides but may not suit every organizer.
- Bridge Potential is a transparent ranking score, not a probability, and **nothing here measures social cohesion**.
- Thresholds (40th-percentile floor, popularity band 0.3–0.9) were set on the New York spike scenario. Five of these cases, including the held-out one, were not used for tuning.
