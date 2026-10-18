# COMMON GROUND

> An agentic cultural-program designer that uses [Qloo](https://www.qloo.com/)'s cultural intelligence to find what two different communities would both genuinely enjoy, and turns it into a concrete, recurring program.

Built for the **Qloo Agentic Hackathon 2026**.

**Try it:** [Common Ground](https://qloo-hackathon-inky.vercel.app). Choose an example or enter your own groups. Completed example runs can replay from the server cache; a new investigation typically takes 60–120 seconds.

## What you can do

1. Add 3–8 favorites for each group. Qloo resolves artists, films, TV, books, games, podcasts and places; confirm ambiguous matches.
2. Set an activity, participant cost, audience, group size, venue and access needs. Choose Familiar, Balanced or Exploratory discovery.
3. Compare up to three cultural bridges, each scored separately against both profiles. Read retrieved descriptions alongside clearly labelled activity-fit interpretations.
4. Build a recurring program around your chosen bridge. Review the delivery checklist, export the plan and adapt the draft invitations.

The agent interprets notes, investigates Qloo, can search further with tools, then writes and critiques the program. It is also available as an [MCP tool](docs/MCP.md).

## Run locally

Requires Node.js 22 or newer, npm, a Qloo hackathon credential, and the existing ChatGPT subscription sign-in used by this project. Redis is optional for local development and required for durable serverless storage.

```bash
git clone https://github.com/Dhamani-aryan/qloo-hackathon.git
cd qloo-hackathon
npm ci
```

Copy `.env.example` to `.env.local`. Configure `QLOO_API_KEY`; hackathon keys use `https://hackathon.api.qloo.com`. Leave the existing LLM provider configuration in place.

```bash
npm run llm:login
node node_modules/next/dist/bin/next dev -p 3005
```

Open [localhost:3005](http://localhost:3005). If a deployed instance already uses the shared Redis credential, use `CHATGPT_AUTH_STORE=redis` with that database instead of creating a competing file credential. See [deployment](docs/DEPLOY.md) for credential storage and Vercel configuration.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Automated tests use synthetic Qloo data. Live verification requires configured credentials. Real API responses and evaluation outputs stay in ignored directories.

## Architecture and evidence

```text
Confirmed profiles + practical choices
    → Qloo discovery across cultural domains
    → separate A/B shortlist scoring and popularity preference
    → bilateral threshold + activity-fit ordering
    → evidence brief with descriptions, categories and unknowns
    → program draft → critic → delivery checks and invitations
```

The server holds credentials, response caches, and evidence briefs. Program regeneration uses an opaque handle to a server-held brief. The browser cannot supply its own evidence to that endpoint.

## Limits

- Relative affinity ranks are not probabilities that people will enjoy or attend an event.
- Activity fit is a product heuristic. Venue access, prices, permissions and capacity are not verified bookings.
- Programs are drafts for organizer and community review. They do not establish an effect on social cohesion.
- The model-only comparison shows provenance, not proof of superiority. Human usefulness ratings remain pending.
- The existing ChatGPT subscription integration is retained. See `.env.example` and the deployment guide for its setup.

- [How it works](docs/HOW_IT_WORKS.md) and [how to test it](docs/TESTING.md)
- [Product plan and research](common_ground_research_and_plan.md)
- [Implementation guide and progress](IMPLEMENTATION.md)

## License

[MIT](LICENSE)
