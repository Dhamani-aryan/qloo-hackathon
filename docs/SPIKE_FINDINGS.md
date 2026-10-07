# API spike findings (Track 1)

**Date:** 2026-10-07 · **Key:** hackathon (`https://hackathon.api.qloo.com`) · **About 150 live calls, no rate limits hit**

Scripts: `spike/00-ping.ts` → `spike/04-features.ts`. Raw responses stayed in git-ignored `spike/out/`. Only summaries and a few example names are recorded here.

---

## Decision: **GO** with Campus ↔ City, New York

The decisive question (plan §18) was: *after popularity adjustment, does Campus ↔ City produce at least three bilateral candidates a human would call non-obvious?*

**Yes.** With popularity-adjusted ranking, the New York scenario produced these bridges, each supported by **both** communities and well outside the mainstream:

| Domain | Obvious bridge (famous, high raw support) | Discovered bridge (high support on both sides × novelty) |
|---|---|---|
| TV | — | **Somebody Somewhere**: 96th percentile for A *and* B, popularity 0.79 |
| Music | Weyes Blood | **DOMi & JD Beck**, a jazz duo with a modern sound (pop 0.80) |
| Places (NYC) | Strawberry Fields | **Royal Tenenbaums House** (film location), **Cannoli King** |
| Books | Fleabag: The Scriptures | **M Train** by Patti Smith (pop 0.78) |
| Film | Marriage Story | weak (only one candidate passed) |

Analysis Compare adds evidenced *themes*, for example **Personal growth** (*Lady Bird* ↔ *Joni Mitchell*) and **Friendship** (*Normal People* ↔ *Cinema Paradiso*).

**Jaipur Craft Futures:** technically works (100% seed resolution, good local places like Amber Fort and Hawa Mahal) but stays a **backup**. Its overlap is driven by a shared national-culture baseline, its "discovered" places are hotels and banquet halls, and its book overlap is dominated by religious and political titles. It needs topic and venue filters first.

---

## Answers to the required questions

**0. Which popularity baseline works?**
The entity **`popularity`** field (a 0–1 percentile), used in two ways:
- **Pool expansion:** a second combined A+B query with `filter.popularity.max=0.9` brings non-mainstream candidates into the pool.
- **Ranking:** `discovered = harmonic_mean(pctA, pctB) × (1 − popularity)`, keeping popularity in [0.3, 0.9] and requiring both pctA and pctB ≥ 0.4.

Rejected:
- *Dividing affinity by popularity* barely changes the ranks and explodes near popularity 0.
- *A neutral (no-signal) query* returns entities but **no affinity**, so it can't be a baseline.

**1. What numeric fields come back?**
- `query.affinity` (0–1). It sits in a narrow ~0.80–0.97 band, so raw values barely discriminate.
- `popularity` (0–1 percentile). Seeds and top results are mostly ≥ 0.95.
- `query.affinity_rank` was **not** returned.
- Explainability scores are about 0.08 per seed.

**2. Are scores comparable across queries?**
No, only within a query. The fix: score **one fixed candidate pool** against A and against B with `filter.results.entities`, then convert to **percentiles within that pool**. Those percentiles are comparable across the two sides.

**3. Does explainability work?**
**Yes.** The shape differs from the docs: `query.explainability["signal.interests.entities"] = [{entity_id, score}]`. The aggregate is under `effect_on_*` lists with `avg_score`. Contributions are spread almost evenly across seeds (A-share ≈ 50% on every item), so it's useful for **provenance** ("supported by these seeds"), not for testing bilaterality. Per-side shortlist scoring does that.

**4. What does Analysis Compare return?**
`results = { tags, a, b, matchEntities }`.
- `tags` are **shared tags**. Each has `query.score` plus the A-side and B-side seed entities that produce it. They repeat per seed pair, so they're merged by tag ID (147 unique for New York).
- `a` and `b` are one-sided tags with `query.count`.
- `matchEntities` was always empty.

Compare is the best source for **program themes** with provenance on both sides.

**5. Which output types work?**
All nine returned 30 results. Video game is `urn:entity:videogame`, which settles the doc conflict.

For bridges:
- **TV, artist, place (with location), book, podcast:** strong.
- **Movie:** weak after the novelty filter.
- **Brand and destination:** generic (GoPro, Vans, Los Angeles), so drop them.

**Production domains:** `tv_show`, `artist`, `book`, `podcast`, `place`, with `movie` optional.

**6. Is location coverage useful?**
- **New York:** `filter.location.query="New York City"` returned 10/10 places in New York, with useful venue-type tags.
- **Jaipur:** works but needs venue-type filtering.

**7. Smallest call set for three good bridges?**
- Per domain: 2 discovery calls (combined top, popularity-capped) plus 2 shortlist scorings (A, B) = **4 calls**.
- Five domains = 20 calls, plus 1 Compare, plus about 16 searches at resolution time.
- With concurrency 3–4, that's roughly **15–25 s** end to end. Prebuilt scenarios should be cached.

**8. Observed limits and latency?**
- No rate limiting at about 150 calls.
- `/search`: median ~0.3 s.
- `/v2/insights`: 0.4–0.9 s for most types, but **3–4 s for movie and artist**.
- `/v2/analysis/compare`: ~0.6 s.
- Untuned `filter.type=urn:tag` taste analysis returns noisy, place-oriented tags. Use Compare for themes instead.

---

## Requirements this adds to the bridge engine (Track 2)

1. The candidate pool must merge the combined top results with popularity-capped results. Intersecting separate A and B top lists is too strict: zero overlap for New York films, music and books.
2. Score with within-pool percentiles, the harmonic mean, the novelty factor, and per-side floors (step 2.6).
3. A **sensitive-topic filter** that excludes religion and politics tags and titles from candidates (plan §15).
4. A **venue-type filter** for places: keep cultural venues, cafés, landmarks and studios; drop hotels and banquet halls.
5. Pick bridges across **different domains**. Each domain usually produces 1–3 strong discovered candidates.
6. Use explainability for provenance and Compare for themes. Neither decides ranking.
