# How Common Ground works

This guide starts with short summaries and then goes into detail. If you only read one part, read **Part 1**.

---

# Part 1: The short version

## What it is, in one paragraph

Common Ground helps someone who runs community programs (a university, library, museum, NGO) bring **two different groups** together. You tell it what each group loves: a few artists, films, TV shows, books or places. It asks **Qloo** (a company that knows which cultural things people like together) to find things **both** groups love that are **not just famous things everybody likes**. Then an **AI** turns the best of those into a ready-to-run **4-session plan**. Every recommendation can be traced back to Qloo's data, and the app shows what the same AI would have produced *without* Qloo.

## The two pages, in one line each

| Page | What you do there |
|---|---|
| **Home** | Two boxes, *Group 1* and *Group 2*. Type a few things each group loves (press Enter after each), add a city, and click **Find common ground →**. Qloo matches every name to a real entry as you type. |
| **Results** | One page, top to bottom: a progress line while it works, then *what everyone likes* vs *what these two groups share*, the top bridges, a 4-session plan, and "Why Qloo matters". |

## The parts under the hood, in one line each

| Part | Plain description | Where in the code |
|---|---|---|
| **Qloo connection** | Talks to Qloo's API: look up names, get recommendations, compare two groups. | `src/lib/qloo/` |
| **Bridge engine** | Pure maths, no AI. Finds candidates, scores them for each group, and ranks the bridges. | `src/lib/engine/` |
| **AI agent** | Uses ChatGPT to plan the search, explain bridges, write the plan and critique it. | `src/lib/agent/`, `src/lib/llm/` |
| **Evidence guard** | Checks every name the AI uses against Qloo's data and removes anything invented. | `src/lib/agent/program.ts` |
| **"AI alone" version** | The same task given to ChatGPT with no Qloo data, so you can compare. | `src/lib/agent/baseline.ts` |
| **Participant links** | Optional: each group fills in its own favourites on a phone link. | `src/lib/intake/`, `/join/...` |
| **Cache** | Saves finished runs so a repeat shows in about 3 s instead of about 70 s. | `src/lib/cache/`, `src/lib/agent/replay.ts` |
| **Website** | The two pages above. | `src/components/`, `src/app/` |

---

# Part 2: The details

## 1. The problem it solves

When organizers try to bring two communities together (students and long-time residents, say), they usually pick something **everyone** likes: a famous film, a big landmark. That's safe but generic, and it doesn't feel like *theirs*. Asking an AI on its own doesn't help much either. It guesses from stereotypes, or it just reuses whatever you told it.

Common Ground looks for a **bridge**: something both groups genuinely rank highly that is specific to them rather than universally popular. That's the core idea: **"bilateral" (both sides) and "not just mainstream"**.

## 2. Words you'll see

| Term | Meaning |
|---|---|
| **Group** (also "community", "side A / B") | One of the two audiences. Group 1 is shown in **blue**, Group 2 in **terracotta/orange**. |
| **Favourite / seed** | Something a group loves (an artist, film, show, book, podcast or place). Each group needs 3 to 8. |
| **Qloo entity** | Qloo's own record for a thing, with an ID, image and type. Every favourite must match one. |
| **Candidate** | Something Qloo suggests might appeal to both groups. One run considers about 200. |
| **Support percentile** | How highly one group ranks a candidate compared with the other candidates. "85th" means it beats 85% of them for that group. |
| **Popularity percentile** | How mainstream something is overall. "100th" means nearly everyone knows it. |
| **Obvious bridge** | High support from both groups, but very popular with everyone (popularity above 90th). |
| **Discovered bridge** | High support from both groups **and** not mainstream. This is what we want. |
| **Bridge Potential** | A 0–100 ranking score. It's not a probability. See section 5. |
| **Evidence** | The record of each Qloo result a claim is based on (`ev_0012`...). You can open it under any bridge on the results page. |
| **Plan / program** | The 4-session program the AI writes from the bridges. |

## 3. What happens when you press "Find common ground"

Here's the default example (a university film & music club vs a neighbourhood arts association in New York), with real numbers from a test run.

**Step 1: Read both groups (instant).** The app takes the matched favourites, up to 8 per group.

**Step 2: Choose what to explore (about 7 s).** The same kinds are always searched: TV shows, artists, books, podcasts and local places, plus films when a group named a film. This is fixed so the same input always gives the same bridges. ChatGPT only writes a one-line reason for each kind.

**Step 3: Search Qloo (about 9 s, no AI).** For each kind it makes 4 Qloo calls, about 25 calls in total:

1. *"What would people who like all of these favourites (both groups combined) also like?"*
2. The same question, but **leaving out very popular items**, to reach past the obvious.
3. *"How much does Group 1 alone like each of these candidates?"*
4. *"How much does Group 2 alone like each of these candidates?"*

It also asks Qloo's **Compare** feature for **themes** both groups share (e.g. "Personal growth": *Lady Bird* ↔ *Joni Mitchell*).

**Step 4: Score and rank (instant, no AI).** Every candidate gets a support percentile for each group and a popularity value. Weak, one-sided, too-niche or sensitive items are rejected, with a reason. The best three are selected (section 5).

**Step 5: Design the plan (about 35 s, AI).** In parallel, ChatGPT:
- writes a short note for each bridge (an activity idea and the main thing to watch out for);
- writes the 4-session plan.

It may **only** use the bridges and runners-up Qloo found. It refers to them by code (B1, B2...), never by free text.

**Step 6: Review and improve it (about 25 s, AI).** A second pass checks the plan against 10 rules: is one group just watching the other? does it need expertise? is it a one-off? are the two groups' roles copy-pasted? and so on. It then fixes the plan.

**Step 7: Compare with AI alone (runs in parallel from the start).** The same goal and the same favourites go to ChatGPT **without any Qloo data**, so you can see the difference at the end.

**Total:** about 70 s live, or about 3 s when the same case was run before (the result is replayed from the cache).

## 4. What you see on the results page

At the top there are two columns:
- **What everyone likes**: e.g. *Strawberry Fields*. Both groups rank it very high (95th and 98th), **but** it's at the 100th popularity percentile. Everyone likes it, so it says nothing special about these two groups.
- **What these two groups share**: e.g. *Cannoli King*. Strong for both (85th and 78th), but only at the 68th popularity percentile. That's a real bridge.

Below that are the **top bridges** (up to three), with a score out of 100 on the right. Only bridges with solid support from **both** groups are shown, so some runs show one or two. Tap a row to see:
- **Linked to these favourites**: which of each group's favourites Qloo credits for the recommendation;
- **How to use it** and **Watch out**: the AI's notes;
- **Qloo evidence**: the raw records (affinity scores, percentiles, ranks).

**More: shared themes, other ideas, what was ruled out** shows shared themes, other good ideas ("also in the running") and how many candidates were rejected and why.

## 5. How the scoring works (the maths, simply)

For each candidate:

1. **Support for each group, as percentiles.** Qloo's raw "affinity" scores all sit between 0.80 and 0.97, so they're hard to compare. Instead the app ranks all candidates for Group 1 and turns each rank into a percentile, then does the same for Group 2.
2. **Both sides must agree.** A candidate is **rejected** if either group puts it below the 40th percentile ("one-sided"), or if both do ("weak support from both").
3. **Combine with a harmonic mean.** `bilateral = 2·A·B / (A + B)`. This is high only when **both** A and B are high. 90 and 90 gives 90, but 100 and 10 gives about 18.
4. **Popularity check:**
   - above 90th percentile → **obvious** (shown as the contrast, not chosen);
   - below 30th → **too niche** (hard to get people to come);
   - in between → **discovered**, and the less mainstream it is, the bigger the bonus (a factor between 0.5 and 1).
5. **Bridge Potential (0–100)** = 70% × (bilateral × novelty) + 20% × evidence variety + 10% × "it's a local place".
6. **Pick up to three:** the best from each kind first (so you don't get three TV shows), then the next best overall. A bridge is only shown if its two-sided score (step 3) is at least 55; weaker ones go to "also in the running". If none pass, the single best is shown.

**Safety filters** run before scoring. Items whose *title or category* is about religion or politics are removed. Places that are hotels, banquet halls, places of worship, bars or breweries, or government buildings are removed as venues, and so are box sets and places named just like the city. Every rejection is listed with its reason.

## 6. What the AI is allowed to do, and the guard

The AI is useful for **planning, explaining and writing**, but it can invent things. So:

- It gets an **evidence brief**: only the bridges, runners-up, the obvious pick, themes and their evidence codes.
- It must point to entities by code (`B1`, `R2`). The guard swaps each code for the real Qloo entity.
- Anything not in the brief is **removed**: unknown codes, made-up evidence IDs, and quoted titles that aren't in Qloo's data (replaced with "[title removed: not in Qloo evidence]").
- The plan shows **"✓ Every session is built on real Qloo data"**, or how many references were removed.

## 7. "Why Qloo matters" (the comparison at the bottom of the results page)

Three numbers compare **With Qloo** and **AI alone**:
- **New titles backed by both groups' data:** e.g. 3 vs 0.
- **Unverified guesses (lower is better):** titles the AI named with no evidence, e.g. 0 vs 7–10.
- **Qloo evidence citations:** e.g. 15 vs 0.

Open **"Compare the two plans session by session"** to see the AI-alone plan. Its picks are greyed if it just reused one of your favourites, and amber if it made something up without evidence.

## 8. Participant links (optional)

Instead of the organizer guessing each group's tastes, click **"Let each group add their own"** under the examples on the home page, then **Create the two links**. Each group gets its own link. People open it on their phone, name up to 3 favourites (no account, no name), and submit. Back on the home page, **Import responses** replaces each group's list with the most-named picks.

The app only stores counts per title. No names, emails or IPs are kept. Right now responses are stored **in the server's memory**, so they disappear when the server restarts. Before deployment this needs a free Upstash Redis database.

## 9. Speed, cost and safety controls

- **Cache:**
  - a finished run is saved for 7 days and replayed in about 3 s, with a note and a **"Run it live"** link;
  - individual Qloo answers are saved for 1 day;
  - right now the cache lives in server memory and resets on restart.
- **Rate limits:** 5 live runs per 10 minutes per visitor (replays are free), so a public demo can't drain the Qloo key or the ChatGPT subscription.
- **Stop button and closing the tab** both cancel the run, so no more calls are made.
- **Errors:** if Qloo is down or the key is wrong, the app says so ("Qloo is unavailable…") rather than showing a misleading "no bridge" result.

## 10. Where things live (for developers)

```text
src/app/page.tsx                 the website (home page + results page)
src/app/join/[id]/[side]/        the participant page
src/app/api/…                    server endpoints: resolve, analysis (streamed), program, intake
src/components/studio/           home-screen, results-screen and their sections
src/lib/qloo/                    Qloo client
src/lib/engine/                  bridge engine (deterministic, no AI)
src/lib/agent/                   planner, notes, program + guard, critic, AI-alone baseline, orchestrator, replay
src/lib/llm/                     ChatGPT-subscription client
src/lib/intake/, src/lib/cache/  participant storage and cache
tests/                           125 automated tests (no real API calls)
spike/                           scripts that call the real APIs from the terminal
```
