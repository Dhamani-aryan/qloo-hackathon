import type { LlmClient, LlmRequest } from "@/lib/llm/types";

/** Answers each agent step by recognising its system prompt (steps run concurrently). */
export function routerLlm(overrides: Partial<Record<string, (req: LlmRequest) => string>> = {}) {
  const seen: string[] = [];
  const session = (n: number, entityRef: string | null) => ({
    number: n,
    title: `Session ${n}`,
    entityRef,
    themeRef: null,
    activity: "Co-create",
    roles: { A: "Scores", B: "Writes" },
  });
  const program = {
    title: "Shared Nights",
    objective: "Recurring shared making",
    bridgeRef: "B1",
    format: "Monthly",
    sessions: [session(1, "B1"), session(2, "B2"), session(3, "B3"), session(4, null)],
    venueType: "Community room",
    partnerTypes: [],
    accessibility: [],
    frictionMitigations: [],
    successMeasures: ["Return attendance"],
    limitations: [],
    evidenceIds: [],
  };
  const handlers: Record<string, (req: LlmRequest) => string> = {
    plan: () =>
      JSON.stringify({
        domains: [
          { domain: "tvShow", reason: "watch club" },
          { domain: "artist", reason: "listening night" },
          { domain: "place", reason: "venue" },
        ],
      }),
    notes: (req) =>
      JSON.stringify({
        notes: ["B1", "B2", "B3"]
          .filter((r) => req.prompt.includes(`"ref": "${r}"`))
          .map((ref) => ({
            ref,
            activityFit: "Make something together",
            mainFriction: "Timing",
            whyBeatsObvious: "Less mainstream, supported on both sides",
            evidenceIds: ["ev_0001"],
          })),
      }),
    program: () => JSON.stringify(program),
    invitations: () =>
      JSON.stringify({
        A: { subject: "For the film club", message: 'If you love "SA1", try "Shared Comedy".' },
        B: {
          subject: "For the arts group",
          message: 'Fans of "Made-up Film" welcome to "Shared Nights (revised)".',
        },
      }),
    review: () => JSON.stringify({ assessment: "Two solid bridges; good enough.", actions: [] }),
    directives: () =>
      JSON.stringify({
        skipDomains: [],
        addDomains: [],
        placeThemes: [],
        audience: null,
        rules: [],
      }),
    critic: () =>
      JSON.stringify({
        issues: [{ check: "generic_roles", problem: "Similar roles", fix: "Distinct roles" }],
        revised: { ...program, title: "Shared Nights (revised)" },
      }),
    baseline: () =>
      JSON.stringify({
        title: "Generic Exchange",
        bridge: "Film",
        format: "Monthly",
        sessions: [1, 2, 3].map((n) => ({
          number: n,
          title: `S${n}`,
          anchor: "A Famous Film",
          activity: "Watch",
          roles: { A: "Watch", B: "Watch" },
        })),
        venueType: "Library",
        successMeasures: ["Attendance"],
      }),
    ...overrides,
  };
  const step = (req: LlmRequest) =>
    req.system.includes("research lead")
      ? "review"
      : req.system.includes("short, warm invitations")
        ? "invitations"
        : req.system.includes("organizer's instructions into settings")
          ? "directives"
          : req.system.includes("plan research")
            ? "plan"
            : req.system.includes("analyst")
              ? "notes"
              : req.system.includes("demanding reviewer")
                ? "critic"
                : req.system.includes("Choose a shared cultural bridge yourself")
                  ? "baseline"
                  : "program";
  const llm: LlmClient = {
    provider: "test",
    model: "test",
    generateText: async (req) => {
      const s = step(req);
      seen.push(s);
      return { text: handlers[s](req), usage: null, model: "test", ms: 1 };
    },
  };
  return { llm, seen };
}
