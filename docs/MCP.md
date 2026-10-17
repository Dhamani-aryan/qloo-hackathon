# Use Common Ground from any AI agent (MCP)

Common Ground is also an **MCP server**, so Claude, ChatGPT or any other agent that supports the Model Context Protocol can call it as a tool. The agent passes two groups' favourites and a city; Common Ground runs the same Qloo-grounded agent as the website and returns the bridges (with each group's support), the 4-session plan and an invitation for each group.

**Endpoint:** `https://qloo-hackathon-inky.vercel.app/api/mcp` (Streamable HTTP, no sign-in)

## Connect

**Claude (claude.ai or the desktop app):** Settings → Connectors → *Add custom connector* → paste the endpoint URL.

**Claude Code:**

```bash
claude mcp add --transport http common-ground https://qloo-hackathon-inky.vercel.app/api/mcp
```

**ChatGPT:** with developer mode on, add a custom MCP connector with the endpoint URL and no authentication (menu names change often; look under Settings → Connectors).

**Anything else:** point your MCP client at the URL. The server speaks JSON-RPC over HTTP POST (`initialize`, `tools/list`, `tools/call`, `ping`).

## The tool

`find_common_ground`

| Argument | Type | Example |
|---|---|---|
| `group_a` | `{ name, favourites: string[3–8] }` | `{ "name": "Teen gamers", "favourites": ["Hollow Knight", "Celeste", "Stardew Valley"] }` |
| `group_b` | `{ name, favourites: string[3–8] }` | `{ "name": "Book club", "favourites": ["Pride and Prejudice", "The Hobbit", "Little Women"] }` |
| `city` | string | `"Chicago"` |
| `notes` | string, optional | `"Teens and adults together, keep it free"` |

Try asking your assistant something like:

> My library runs a teen gaming club (they love Hollow Knight, Celeste and Stardew Valley) and an adult book club (Pride and Prejudice, The Hobbit, Little Women). We're in Chicago. Find something both groups would come to, and keep it free.

## What comes back

Plain text the calling agent can quote or build on:
- what the agent decided (searches it added, rules it took from the notes);
- the "obvious" pick it rejected, and why;
- up to three bridges, each with **both groups' support percentiles** and popularity;
- the 4-session plan with each group's role;
- one invitation per group;
- a link to explore the result visually.

A new pair of groups takes about 1–2 minutes (live Qloo search and four LLM steps). Repeats come from the cache in a second or two. Live runs share the website's rate limit.

## Why expose it this way

The hackathon asks for agents that know what people actually like. As an MCP tool, Common Ground gives *any* general assistant that ability for one specific, hard job: finding culture two different groups genuinely share. Qloo provides the taste data and the scoring keeps it honest.
