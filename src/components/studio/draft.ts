import type { Scenario } from "@/lib/engine/types";
import type { QlooTypeKey } from "@/lib/qloo/types";
import type { PrebuiltScenario } from "@/scenarios";

/** Client-side editable scenario ("draft") and its reducer. */

export interface Match {
  id: string;
  name: string;
  type: string | null;
  disambiguation: string | null;
  imageUrl: string | null;
  popularity: number | null;
  description: string | null;
}

export interface DraftSeed {
  key: string;
  input: string;
  type?: QlooTypeKey;
  status: "resolving" | "resolved" | "unresolved" | "error";
  matches: Match[];
  chosenId: string | null;
  confirmed: boolean;
  /** Why the match needs a human check, if it does. */
  reasons: string[];
  /** Participants who named this entity (intake); 1 for organizer seeds. */
  weight: number;
}

export interface DraftProfile {
  label: string;
  source: "organizer" | "intake";
  contributorCount: number | null;
  seeds: DraftSeed[];
}

export interface Draft {
  id: string;
  title: string;
  objective: string;
  location: string;
  a: DraftProfile;
  b: DraftProfile;
}

export type SideKey = "a" | "b";
export const MIN_SEEDS = 3;
export const MAX_SEEDS = 8;

let counter = 0;
export const seedKey = () => `seed-${Date.now().toString(36)}-${counter++}`;

export function newSeed(input: string, type?: QlooTypeKey): DraftSeed {
  return {
    key: seedKey(),
    input,
    type,
    status: "resolving",
    matches: [],
    chosenId: null,
    confirmed: false,
    reasons: [],
    weight: 1,
  };
}

export function emptyDraft(): Draft {
  const profile = (label: string): DraftProfile => ({
    label,
    source: "organizer",
    contributorCount: null,
    seeds: [],
  });
  return {
    id: `custom-${Date.now().toString(36)}`,
    title: "Custom scenario",
    objective: "",
    location: "",
    a: profile(""),
    b: profile(""),
  };
}

/** Used when the organizer gives no goal (the home screen doesn't ask for one). */
export const DEFAULT_OBJECTIVE =
  "Design a four-session recurring program both groups would choose to join and keep coming back to.";

export const groupName = (p: DraftProfile, side: SideKey) =>
  p.label.trim() || (side === "a" ? "Group 1" : "Group 2");

export function draftFromPrebuilt(p: PrebuiltScenario): Draft {
  const profile = (side: PrebuiltScenario["a"]): DraftProfile => ({
    label: side.label,
    source: "organizer",
    contributorCount: null,
    seeds: side.seeds.map((s) => newSeed(s.name, s.type)),
  });
  return {
    id: p.id,
    title: p.title,
    objective: p.objective,
    location: p.location,
    a: profile(p.a),
    b: profile(p.b),
  };
}

export type DraftAction =
  | { type: "replace"; draft: Draft }
  | { type: "set"; patch: Partial<Pick<Draft, "title" | "objective" | "location">> }
  | { type: "profile"; side: SideKey; patch: Partial<Omit<DraftProfile, "seeds">> }
  | { type: "addSeed"; side: SideKey; seed: DraftSeed }
  | { type: "updateSeed"; side: SideKey; key: string; patch: Partial<DraftSeed> }
  | { type: "removeSeed"; side: SideKey; key: string };

export function draftReducer(draft: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case "replace":
      return action.draft;
    case "set":
      return { ...draft, ...action.patch };
    case "profile":
      return { ...draft, [action.side]: { ...draft[action.side], ...action.patch } };
    case "addSeed":
      return {
        ...draft,
        [action.side]: { ...draft[action.side], seeds: [...draft[action.side].seeds, action.seed] },
      };
    case "updateSeed":
      return {
        ...draft,
        [action.side]: {
          ...draft[action.side],
          seeds: draft[action.side].seeds.map((s) =>
            s.key === action.key ? { ...s, ...action.patch } : s,
          ),
        },
      };
    case "removeSeed":
      return {
        ...draft,
        [action.side]: {
          ...draft[action.side],
          seeds: draft[action.side].seeds.filter((s) => s.key !== action.key),
        },
      };
  }
}

export function chosenMatch(seed: DraftSeed): Match | null {
  return seed.matches.find((m) => m.id === seed.chosenId) ?? null;
}

export function confirmedCount(p: DraftProfile): number {
  return p.seeds.filter((s) => s.confirmed && chosenMatch(s)).length;
}

/** Problems that block running the analysis, or [] if ready. */
export function readiness(draft: Draft): string[] {
  const problems: string[] = [];
  for (const side of ["a", "b"] as const) {
    const p = draft[side];
    const n = confirmedCount(p);
    const name = groupName(p, side);
    if (p.seeds.some((s) => s.status === "resolving")) {
      problems.push(`Looking up ${name}'s favourites…`);
    } else if (n < MIN_SEEDS) {
      const missing = MIN_SEEDS - n;
      problems.push(`Add ${missing} more favourite${missing === 1 ? "" : "s"} for ${name}.`);
    }
  }
  if (!draft.location.trim()) problems.push("Add a city.");
  return problems;
}

/** Convert the draft into the engine's Scenario (confirmed seeds only). */
export function toScenario(draft: Draft): Scenario {
  const profile = (side: SideKey) => {
    const p = draft[side];
    return {
      side: side === "a" ? ("A" as const) : ("B" as const),
      label: groupName(p, side),
      source: p.source,
      contributorCount: p.contributorCount,
      seeds: p.seeds.flatMap((s) => {
        const m = chosenMatch(s);
        return s.confirmed && m
          ? [
              {
                input: s.input,
                entityId: m.id,
                name: m.name,
                type: m.type,
                popularity: m.popularity,
                imageUrl: m.imageUrl,
                confirmed: true,
                weight: s.weight,
              },
            ]
          : [];
      }),
    };
  };
  return {
    id: draft.id,
    title: draft.title,
    objective: draft.objective.trim() || DEFAULT_OBJECTIVE,
    location: draft.location.trim() || null,
    a: profile("a"),
    b: profile("b"),
  };
}
