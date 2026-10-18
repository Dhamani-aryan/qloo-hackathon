# Devpost submission (ready to paste)

**Demo:** https://qloo-hackathon-inky.vercel.app
**Code:** https://github.com/Dhamani-aryan/qloo-hackathon (MIT)
**MCP endpoint:** https://qloo-hackathon-inky.vercel.app/api/mcp

## Tagline

Find culture two different groups both genuinely like, and turn it into a program they'll come back to.

## Inspiration

Universities, libraries and community centres keep trying to bring two groups together: students and neighbours, teenagers and a choir, newcomers and long-time residents. The result is usually a generic "film night" that only one group attends. A chatbot doesn't help: given each group's favourites, it mostly repeats them back or invents picks with no evidence either group cares. The hard part is finding something specific to these two groups, and checking it works in real life.

## What it does

An organizer enters 3–8 favourites per group (or sends each group a phone link) plus practical choices: activity, cost, ages, group size, an existing venue, access needs, and how adventurous the picks should be. Common Ground:

1. resolves every favourite through Qloo (ambiguous names must be confirmed);
2. discovers about 250 candidates across TV, music, books, podcasts, local places, films and games, and **scores each one separately for both groups**; a bridge must reach the 50th percentile for both, and most candidates are one-sided and rejected;
3. lets an AI agent review the evidence and **decide whether to search further**: another kind of culture, or places in the city on a Qloo tag (e.g. "Jazz club"). It explains each decision;
4. shows up to three bridges with Qloo's descriptions and which favourites drove them, next to the mainstream pick it passed over;
5. writes a 4-session plan on the bridge the organizer chooses (rebuildable on another bridge), critiques it, and adds a delivery checklist (venue, cost, access, media rights) and an invitation for each group in that group's own terms.

It is also an MCP tool, so Claude, ChatGPT or any agent can call `find_common_ground`.

## How we built it

Next.js 16 on Vercel, TypeScript, Upstash Redis. Qloo `/search`, `/v2/insights` (combined signal with explainability, a popularity-capped pass, and per-group scoring with `filter.results.entities`), `/v2/analysis/compare` for shared themes, and `/v2/tags` + `filter.tags` as an agent tool. The bridge engine is deterministic: the same input gives the same bridges, every claim is tied to an evidence record, and the model can't invent a bridge. The model (via the owner's ChatGPT subscription) interprets organizer notes, reviews evidence and chooses tools, writes the plan, critiques it and drafts invitations; a guard removes any title that isn't in Qloo's evidence. 185 automated tests run on synthetic Qloo data.

## Challenges

- **Relative scores lie when groups barely overlap.** A kids'-TV group and a death-metal group still got "bridges" at the 55th percentile. Now, when Qloo's Compare finds no shared theme, a stricter bar applies and the page says so.
- **Reproducibility vs agency.** Letting the model pick what to search made results change between runs, so the core search is fixed and the agent only *adds* searches whose results must beat what it already has.
- **Honesty about the real world.** Qloo affinity isn't venue availability, price or attendance. Live testing caught schools, a hospital and bars suggested as venues; filters, audience settings and an explicit checklist now handle these.

## Accomplishments

In a 16-case live evaluation (including mismatched groups, all-ages settings, an existing free venue, Korean and Japanese titles and a small city): 16/16 completed, 16/16 reproducible, and 27/27 automated checks passed. Every bridge reaches the 50th percentile for both groups and averages the 74th popularity percentile, against the 98th for the obvious pick. Given the same inputs, the model alone named 188 titles: 148 just repeated the favourites and 40 had no evidence.

## What we learned

Cultural intelligence is most useful as **evidence about two sides at once**, not as a recommendation list. The agent is most trustworthy when it can widen the search but can't decide the answer.

## What's next

Blind reviews of proposals by real program organizers (not yet done, so we don't claim people prefer them), follow-up attendance tracking through the participant links, and more venue-type data.
