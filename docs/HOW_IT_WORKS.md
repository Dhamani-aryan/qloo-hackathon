# How Common Ground works

Common Ground helps an organizer find a cultural starting point for two groups and turn it into a recurring program. Qloo supplies cultural evidence; an agent proposes activities and a critic reviews the draft. The organizer confirms practical arrangements.

## 1. Define the groups

Start with your own groups or load Campus ↔ City or Jaipur Craft Futures. Examples use hypothetical cultural profiles.

Add 3–8 favorites per group. The search covers music, films, TV, books, games, podcasts and places. You can narrow the type before searching. Each result shows its type; click it to inspect the description or choose another match. Ambiguous matches require confirmation before analysis.

Participant intake is available through **Let each group add their own**. Links collect aggregate favorites rather than personal profiles. Organizers import the most frequently named picks. Upstash stores the aggregate responses when configured; memory storage is only suitable for local development.

## 2. State practical preferences

The optional settings capture:

- activity: mixed, watching, listening, making, exploring, playing;
- participant cost: unspecified, free, or some spending possible;
- audience: unspecified, mixed ages including under-18s, or adults;
- number of participants;
- existing venue, outings, or flexible location;
- access needs;
- Familiar, Balanced, or Exploratory discovery.

Notes provide additional instructions, such as excluding podcasts or looking for parks. Typed settings are applied directly. Both Qloo-backed generation and the model-only comparison receive the same practical constraints.

## 3. Investigate with Qloo

The engine queries combined cultural seeds across validated domains. A second, popularity-capped query expands discovery beyond mainstream results. Each domain has a bounded candidate pool.

It then scores the same pool independently against Group 1 and Group 2 using Qloo shortlist filtering. Affinities become percentile ranks within that pool; they are not percentages of participants or probabilities of enjoyment.

Shared themes come from Analysis Compare. Explainability identifies input contributors and provides provenance; it is not proof that a particular person likes an item.

The agent may search additional domains or place tags when the evidence or organizer instructions warrant it. A shared operation budget covers the investigation, and repeated identical requests are reused. Low-level HTTP retries remain separately bounded.

## 4. Select bridges

Every shown bridge needs at least the 50th percentile on both sides and a harmonic mean of at least 0.55. When none qualify, the app reports insufficient evidence. It does not lower the threshold to fill three slots.

The cultural ranking uses 80% preference-adjusted bilateral support and 20% evidence diversity. Places receive no automatic score bonus for being geographically local.

- **Familiar:** mainstream candidates can qualify, with no novelty discount.
- **Balanced:** cultural support has more influence than novelty.
- **Exploratory:** less mainstream candidates receive the stronger novelty modifier.

Activity fit is a separate, transparent heuristic based on the requested activity and retrieved descriptions/categories. Suitable media or venues are ordered ahead of candidates that need adaptation, while keeping the bilateral threshold. Activity fit does not verify admission, capacity, access, permission or availability.

## 5. Choose, shape, prepare

The result workspace has three views:

1. **Choose a bridge:** compare up to three options, descriptions, input contributors, relative ranks and activity-fit explanations. Advanced source queries are expandable. A mainstream alternative is available for comparison.
2. **Shape the program:** review the initial draft or build around another bridge. Sessions have balanced roles, specific cultural anchors and practical alternatives. The critic revises the first draft.
3. **Prepare to run it:** review delivery checks, mark your own confirmations, adapt invitations, and optionally compare the model-only proposal.

The agent receives Qloo descriptions and categories, not just names. It must explain how an anchor's properties change the activity. Unknown venue facts remain unknown. Only selected bridges and strongly supported runners-up are eligible program anchors.

Reference guards validate entity codes and evidence IDs, replace internal codes in prose, and report removed quoted titles. This is reference checking, not verification of every generated factual statement. Organizers still review the text.

## 6. Delivery checks

The app separates checked cultural references from unresolved delivery arrangements. Venue, capacity, cost, access, audience suitability, media permissions and recording require organizer confirmation. A directly detectable outing conflict with an existing-venue requirement is flagged for revision.

Checkmarks stay in the current browser session for that program. They reset after refresh or replacement and are not evidence of an external booking. Exported Markdown includes unresolved delivery checks.

Invitations are drafts. They are never sent automatically.

## 7. Evidence and comparison

The model-only proposal gets the same favorites, objective, notes and practical settings, without Qloo. The comparison counts unique named entities and evidence citations. Structured title arrays preserve punctuation such as commas and ampersands.

These counts show provenance. An unvalidated model proposal is not necessarily false, and more citations do not prove a better program. Human evaluation remains necessary.

## 8. Server behavior

Credentials stay on the server. Qloo responses are cached for one day and eligible complete runs for seven days. Runs with relevant failures or guard removals are not recorded. Replays are labelled and can be bypassed with **Run it live**. Cache release and practical settings are part of the key.

Program regeneration accepts a random handle to a server-held evidence brief, valid for 24 hours. Client-authored briefs are rejected. The same Upstash database supports deployment cache, intake, rate limits, evidence handles and the existing ChatGPT credential store. Local memory is the development fallback.

Rate limits apply to live analysis, regeneration, resolution and intake. Cancellation stops subsequent operations and aborts active model requests. Stale streams cannot overwrite a newer run in the browser.

The ChatGPT subscription integration is unchanged. See [deployment](DEPLOY.md), [MCP](MCP.md), and [testing](TESTING.md).
