/** Build an engine `Scenario` from a resolved spike scenario (spike/out/resolved.json). */
import { ScenarioSchema, type Scenario } from "../src/lib/engine";
import { readResolved, type ResolvedSeed } from "./lib";

export const OBJECTIVES: Record<string, string> = {
  "campus-city-nyc":
    "Design a four-session recurring program that connects a university film & music club " +
    "with a neighbourhood arts association, so both groups keep coming back and make something together.",
  "jaipur-craft-futures":
    "Design a four-session program where young digital creators and heritage craft " +
    "practitioners collaborate as equals on contemporary work rooted in tradition.",
};

export function loadScenario(id: string): Scenario {
  const resolved = readResolved().find((s) => s.id === id);
  if (!resolved) throw new Error(`Unknown scenario: ${id}`);
  const toSeed = (s: ResolvedSeed) =>
    s.id
      ? [
          {
            input: s.name,
            entityId: s.id,
            name: s.resolvedName ?? s.name,
            type: s.resolvedType,
            popularity: s.popularity,
            confirmed: true,
          },
        ]
      : [];
  return ScenarioSchema.parse({
    id: resolved.id,
    title: resolved.title,
    objective: OBJECTIVES[id] ?? "",
    location: resolved.location ?? null,
    a: {
      side: "A",
      label: resolved.a.label,
      source: "organizer",
      seeds: resolved.a.seeds.flatMap(toSeed),
    },
    b: {
      side: "B",
      label: resolved.b.label,
      source: "organizer",
      seeds: resolved.b.seeds.flatMap(toSeed),
    },
  });
}
