import { z } from "zod";
import { runAgent, type AgentDeps, type AgentResult } from "@/lib/agent/orchestrator";
import { loadRecording, recordRun, runKey } from "@/lib/agent/replay";
import type { Cache } from "@/lib/cache/cache";
import { createLimiter } from "@/lib/engine/context";
import { resolveSeed, ScenarioSchema, toSeed, type Scenario } from "@/lib/engine";

/**
 * A minimal MCP server (Streamable HTTP, JSON responses) so other agents (Claude, ChatGPT,
 * any MCP client) can call Common Ground as a tool. One tool, `find_common_ground`: it resolves
 * the favourites through Qloo, runs the same agent as the website (or replays a cached run),
 * and returns the bridges, the plan and the invitations as text with evidence numbers.
 */

const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "common-ground", title: "Common Ground", version: "1.0.0" };

const GroupSchema = z.object({
  name: z.string().trim().min(1).max(80),
  favourites: z.array(z.string().trim().min(1).max(120)).min(3).max(8),
});
export const FindArgsSchema = z.object({
  group_a: GroupSchema,
  group_b: GroupSchema,
  city: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(400).optional(),
});

const groupJsonSchema = {
  type: "object",
  properties: {
    name: { type: "string", description: "A short name for the group" },
    favourites: {
      type: "array",
      items: { type: "string" },
      minItems: 3,
      maxItems: 8,
      description: "3–8 things the group loves: artists, films, TV shows, books, places, games",
    },
  },
  required: ["name", "favourites"],
};

export const TOOLS = [
  {
    name: "find_common_ground",
    title: "Find common ground between two groups",
    description:
      "Finds cultural 'bridges' that two different groups would BOTH genuinely enjoy, using " +
      "Qloo's taste data, and turns the best into a 4-session community program with an " +
      "invitation for each group. Every bridge is scored against each group separately, so " +
      "it is not just something popular. Takes about 1–2 minutes when not cached.",
    inputSchema: {
      type: "object",
      properties: {
        group_a: groupJsonSchema,
        group_b: groupJsonSchema,
        city: { type: "string", description: "Where the program will run, e.g. 'London'" },
        notes: {
          type: "string",
          description: "Optional organizer notes, e.g. 'all ages, keep it free, about food'",
        },
      },
      required: ["group_a", "group_b", "city"],
    },
    annotations: { readOnlyHint: true, openWorldHint: true },
  },
];

type JsonRpc = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: unknown };

const reply = (id: JsonRpc["id"], result: unknown) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, result });
const rpcError = (id: JsonRpc["id"], code: number, message: string) =>
  Response.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export interface McpDeps {
  deps: () => AgentDeps;
  cache?: () => Cache;
  /** Called only before a LIVE run; return a message to refuse it (rate limit). */
  beforeLive?: () => Promise<string | null>;
  appUrl: string;
}

const resolveLimit = createLimiter(3);

/** Resolve favourites through Qloo and build the same Scenario the website would. */
export async function buildScenario(
  args: z.infer<typeof FindArgsSchema>,
  deps: AgentDeps,
): Promise<{ scenario: Scenario; unmatched: string[] }> {
  const unmatched: string[] = [];
  const side = async (key: "A" | "B", g: z.infer<typeof GroupSchema>) => {
    const seeds = await Promise.all(
      g.favourites.map((input) =>
        resolveLimit(async () => {
          const r = await resolveSeed(deps.qloo, { input });
          if (!r.best) unmatched.push(input);
          return r.best ? toSeed(input, r.best) : null;
        }),
      ),
    );
    return {
      side: key,
      label: g.name,
      source: "organizer" as const,
      seeds: seeds.filter((s) => s !== null),
    };
  };
  const [a, b] = await Promise.all([side("A", args.group_a), side("B", args.group_b)]);
  const scenario = ScenarioSchema.parse({
    id: "mcp",
    title: `${args.group_a.name} + ${args.group_b.name}`,
    objective:
      "Design a four-session recurring program both groups would choose to join and keep coming back to.",
    location: args.city,
    instructions: args.notes ?? "",
    a,
    b,
  });
  return { scenario, unmatched };
}

function ordinal(n: number): string {
  const tens = n % 100;
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
const pct = (v: number | null) => (v === null ? "?" : ordinal(Math.round(v * 100)));

/** Plain-text answer for the calling agent: bridges with evidence, the plan, invitations. */
export function summarize(r: AgentResult, unmatched: string[], appUrl: string): string {
  const { scenario, engine, program, invitations } = r;
  const lines: string[] = [`# Common ground: ${scenario.a.label} + ${scenario.b.label}`];
  if (unmatched.length) lines.push(`Not found in Qloo (left out): ${unmatched.join(", ")}.`);
  if (r.decisions.length) {
    lines.push("", "## What the agent did", ...r.decisions.map((d) => `- ${d.text}`));
  }
  if (!engine || engine.status !== "ok") {
    lines.push("", r.failure ?? "No strong common ground found. Try more varied favourites.");
    return lines.join("\n");
  }
  if (engine.obvious) {
    lines.push(
      "",
      `Obvious pick (everyone likes it, popularity ${pct(engine.obvious.popularity)} percentile): ` +
        `${engine.obvious.entity.name}. Not chosen, because it says nothing specific about these groups.`,
    );
  }
  lines.push(
    "",
    "## Bridges (support = percentile within the candidate pool, per group)",
    ...engine.bridges.map(
      (b, i) =>
        `${i + 1}. ${b.entity.name} (${b.domain}): ${scenario.a.label} ${pct(b.pct.A)}, ` +
        `${scenario.b.label} ${pct(b.pct.B)}, popularity ${pct(b.popularity)} percentile, ` +
        `score ${b.bridgePotential}/100`,
    ),
  );
  if (program) {
    lines.push("", `## Plan: ${program.title}`, program.objective);
    for (const s of program.sessions) {
      lines.push(
        "",
        `### Session ${s.number}: ${s.title}${s.entity ? ` (built on ${s.entity.name})` : ""}`,
        s.activity,
        `- ${scenario.a.label}: ${s.roles.A}`,
        `- ${scenario.b.label}: ${s.roles.B}`,
      );
    }
  }
  if (invitations) {
    lines.push(
      "",
      "## Invitations",
      `**For ${scenario.a.label}:** ${invitations.A.subject}`,
      invitations.A.message,
      "",
      `**For ${scenario.b.label}:** ${invitations.B.subject}`,
      invitations.B.message,
    );
  }
  lines.push("", `Explore it visually: ${appUrl}`);
  return lines.join("\n");
}

async function findCommonGround(args: unknown, mcp: McpDeps, signal: AbortSignal) {
  const parsed = FindArgsSchema.safeParse(args);
  if (!parsed.success) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Invalid arguments: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        },
      ],
    };
  }
  const deps = mcp.deps();
  const { scenario, unmatched } = await buildScenario(parsed.data, deps);
  for (const side of [scenario.a, scenario.b]) {
    if (side.seeds.length < 3) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Only ${side.seeds.length} of ${side.label}'s favourites were found in Qloo; at least 3 are needed. Not found: ${unmatched.join(", ")}.`,
          },
        ],
      };
    }
  }

  const store = mcp.cache?.();
  const key = runKey(scenario, {});
  let result: AgentResult | null = store
    ? ((await loadRecording(store, key))?.result ?? null)
    : null;
  if (!result) {
    const refused = await mcp.beforeLive?.();
    if (refused) return { isError: true, content: [{ type: "text", text: refused }] };
    const live = runAgent(deps, scenario, { maxCalls: 40, signal });
    for await (const e of store ? recordRun(live, store, key) : live) {
      if (e.type === "done") result = e.result;
    }
  }
  if (!result) throw new Error("The agent ended without a result");
  return { content: [{ type: "text", text: summarize(result, unmatched, mcp.appUrl) }] };
}

export async function handleMcp(req: Request, mcp: McpDeps): Promise<Response> {
  let msg: JsonRpc;
  try {
    msg = (await req.json()) as JsonRpc;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (Array.isArray(msg) || msg?.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    return rpcError(null, -32600, "Invalid request (batches are not supported)");
  }
  // Notifications (no id) need no answer.
  if (msg.id === undefined) return new Response(null, { status: 202 });

  switch (msg.method) {
    case "initialize": {
      const asked = (msg.params as { protocolVersion?: string } | undefined)?.protocolVersion;
      return reply(msg.id, {
        protocolVersion: asked && PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions:
          "Use find_common_ground when someone wants an activity, event or program that two " +
          "different groups would both enjoy. Pass 3–8 favourites per group and a city.",
      });
    }
    case "ping":
      return reply(msg.id, {});
    case "tools/list":
      return reply(msg.id, { tools: TOOLS });
    case "tools/call": {
      const params = msg.params as { name?: string; arguments?: unknown } | undefined;
      if (params?.name !== "find_common_ground") {
        return rpcError(msg.id, -32602, `Unknown tool: ${params?.name}`);
      }
      try {
        return reply(msg.id, await findCommonGround(params.arguments, mcp, req.signal));
      } catch (e) {
        return reply(msg.id, {
          isError: true,
          content: [{ type: "text", text: `Common Ground failed: ${(e as Error).message}` }],
        });
      }
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}
