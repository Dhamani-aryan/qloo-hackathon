# Evaluation (step 5.3)

**Run:** 2026-10-17 · **Cases:** 8 (1 held out) · **Mode:** every case live (Qloo + LLM, no cache)

This is a **formative** evaluation: six fixed scenarios (plus repeats with organizer notes), technical metrics, the agent's own decisions, and a with/without-Qloo ablation. It does **not** measure social impact, and the seeds are hypothetical test inputs, not real communities. Human ratings are collected separately (see "Human review" below).

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
| Runs completing with a plan | 8 / 8 |
| Seeds resolved to a Qloo entity | 100% (78 exact, 4 flagged for a human check, 0 not found) |
| Mean end-to-end time (live) | 72 s |
| Mean Qloo calls per run | 25.6 |
| Candidates considered per run (mean) | 245 |
| Candidates failing the two-sided test | 66% of all candidates |
| Plan sessions anchored to a Qloo entity | 88% (28 / 32; the rest are co-creation sessions) |
| Unverified references removed by the evidence guard | 0 |
| Every shown bridge at or above the 50th percentile for both groups | Yes (lowest: 50th) |
| Same top-3 bridges on an immediate rerun of the engine (including the agent's extra searches) | 8 / 8 |
| Mean popularity of the obvious pick vs the chosen bridges | 99 vs 72 (percentile) |

**Rejections across all runs:** 1036 one-sided · 265 weak on both · 101 sensitive topic · 65 unsuitable venue · 40 mature content (under-18 group) · 6 too niche · 3 bundle or box set · 2 named like the city.

**What the critic fixed most often:** generic roles (6), unsupported claims (2), decorative bridge (1).

## Ablation: with vs without Qloo

| | Common Ground | LLM only |
|---|---|---|
| Plan anchors that are new titles **backed by both groups' Qloo data** | **28** | 0 |
| Titles that just **reuse the favourites** it was given | — | 65 of 110 named |
| **Unverified** titles (named without any evidence) | 0 | 45 of 110 named |
| Evidence citations | 131 | 0 |

## Per case

| Case | City | Status | Top bridges (support A / B · popularity) | Obvious pick (popularity) | Ablation: Qloo-found vs LLM reused / unverified |
|---|---|---|---|---|---|
| University ↔ neighbourhood | New York City | ok | Cannoli King (90/78 · 68); Royal Tenenbaums House (88/90 · 83); Somebody Somewhere (96/100 · 79) | Fleishman Is in Trouble (92) | 3 vs 12 / 8 |
| Youth culture ↔ older enthusiasts | London | ok | Rain Dogs (69/100 · 49); 221B Baker St (79/68 · 79); High Fidelity (100/65 · 90) | Abbey Road Studios (100) | 4 vs 8 / 9 |
| Hobby groups | Chicago | ok | Gallagher House (100/60 · 79); Norse Mythology (81/53 · 89); TOEM (60/67 · 88) | Cloud Gate (100) | 4 vs 9 / 2 |
| Contemporary ↔ classical | Mumbai | ok | Pearl Academy (96/83 · 77); The Mindvalley Podcast with Vishen (86/93 · 74); Jamtara: Sabka Number Ayega (77/85 · 81) | On Purpose with Jay Shetty (99) | 3 vs 7 / 3 |
| Nightlife ↔ performing arts | Berlin | ok | Moab Is My Washpot (83/94 · 40); David Hasselhoff Museum (88/97 · 79); Here and Now (77/73 · 70) | East Side Gallery (100) | 4 vs 6 / 5 |
| Dance crew ↔ community choir *(held out)* | Toronto | ok | Over The Rainbow (55/90 · 77); Are You Human Too? (50/81 · 59); Sex Education: The Road Trip (53/67 · 53) | Little Women (100) | 3 vs 8 / 7 |
| Hobby groups, with notes | Chicago | ok | Gallagher House (100/60 · 79); Norse Mythology (81/53 · 89); TOEM (60/67 · 88) | Cloud Gate (100) | 4 vs 7 / 2 |
| Youth culture ↔ older enthusiasts, with notes | London | ok | Borough Market (52/68 · 38); Rain Dogs (69/100 · 49); 221B Baker St (86/77 · 79) | Abbey Road Studios (100) | 3 vs 8 / 9 |

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
| Youth culture ↔ older enthusiasts, with notes | 1 | — | Jazz club | 8 |

### Following the organizer's notes

2 cases repeat earlier groups with notes for the agent. Each check is verified in code against the run's output: **6 / 6 passed**.

- **Hobby groups, with notes:** "Some members are 14 to 17. No podcasts please, and every session must be free."
  - ✓ no podcast searched or suggested
  - ✓ treated as an under-18 group (mature filter on)
  - ✓ nothing tagged Mature suggested
  - ✓ notes understood (turned into settings the agent applied)
- **Youth culture ↔ older enthusiasts, with notes:** "Adults only. We'd love it to centre on a live jazz venue in the city."
  - ✓ searched jazz places
  - ✓ notes understood (turned into settings the agent applied)


## What earlier runs found, and what changed

**Run 1 → content rules.** Four bridges were unsuitable for a community program. They were fixed with responsible-use rules, not score tuning (`src/lib/engine/filters.ts`). One came from the held-out case; the fix is a venue-type rule, not a threshold change.

**Run 2 → accuracy changes.** Two issues made results less trustworthy:
- *Repeatability:* the LLM planner picked different categories on different runs, so the same input could give different bridges (Berlin). Every proven category now always runs, and films only when a group named a film.
- *Weak third bridges:* some bridges passed at about the 51st percentile for both groups (Toronto). Only bridges with solid support from both groups (harmonic mean ≥ 0.55) are shown now; weaker ones move to "also in the running".

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
| University ↔ neighbourhood | Cannoli King; Somebody Somewhere; Yola | Cannoli King; Royal Tenenbaums House; Somebody Somewhere |
| Youth culture ↔ older enthusiasts | Rain Dogs; Palace of Westminster; 221B Baker St | Rain Dogs; 221B Baker St; High Fidelity |
| Hobby groups | Chicago; Ôoku: The Inner Chambers; Alice Oseman Collection 6 Books Set (Solitaire, Loveless, This Winter, Radio Silence, Nick and Charlie, I Was Born for This) | Gallagher House; Norse Mythology; TOEM |
| Contemporary ↔ classical | Pearl Academy; Jamtara: Sabka Number Ayega; The New Classmate | Pearl Academy; The Mindvalley Podcast with Vishen; Jamtara: Sabka Number Ayega |
| Nightlife ↔ performing arts | David Hasselhoff Museum; Here and Now; What Remains | Moab Is My Washpot; David Hasselhoff Museum; Here and Now |
| Dance crew ↔ community choir | IZUMI Brewery (Ontario Spring Water Sake Company); Are You Human Too?; DAWN 던 | Over The Rainbow; Are You Human Too?; Sex Education: The Road Trip |
| Hobby groups, with notes | — | Gallagher House; Norse Mythology; TOEM |
| Youth culture ↔ older enthusiasts, with notes | — | Borough Market; Rain Dogs; 221B Baker St |

## Human review

Running the evaluation writes one **blind packet** per case to `eval/out/packets/`. Each has two unlabelled plans (Common Ground and LLM only, in random order), a 1–5 rating form on seven criteria (cultural specificity, authenticity, appeal to each group, actionability, novelty without forcedness, likelihood of repeat attendance), and "which would you fund or run, and why?". The answer key is in `*.key.json`.

**Status:** pending. The target is about 5 reviewers. Results will be reported here honestly as informal feedback, not as a study.

## Limitations

- The seeds are plausible but **hypothetical**. Real profiles would come from participant intake.
- There are six base cases plus note variants, one run each. The LLM steps are non-deterministic; only the Qloo engine is reproducible.
- Bridges are only as good as Qloo's data for each group. For example, Mumbai's profiles surface a self-help podcast as a bridge, which is supported by both sides but may not suit every organizer.
- Bridge Potential is a transparent ranking score, not a probability, and **nothing here measures social cohesion**.
- Thresholds (40th-percentile floor for candidates, 50th for shown bridges, popularity band 0.3–0.9) were set on the New York spike scenario and the run 1–4 findings. Five of these cases, including the held-out one, were not used for tuning.
