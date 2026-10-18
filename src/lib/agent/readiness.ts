import type { EvidenceBrief } from "./brief";
import type { Program } from "./program";
import { DEFAULT_SETTINGS } from "@/lib/planning";

export interface DeliveryCheck {
  id: string;
  label: string;
  status: "satisfied" | "confirm" | "conflict";
  detail: string;
}

/** Deterministic checks of what is known. No claim that costs or access were externally verified. */
export function deliveryChecks(program: Program, brief: EvidenceBrief | null): DeliveryCheck[] {
  const settings = brief?.scenario.settings ?? DEFAULT_SETTINGS;
  const anchored = program.sessions.filter((s) => s.entity).length;
  const guard = program.guard;
  const changed =
    guard.removedTitles.length +
    guard.removedEntityRefs.length +
    guard.removedEvidenceIds.length +
    guard.removedThemeRefs.length;
  const allowed = new Set(
    brief?.entities.filter((e) => e.role !== "obvious").map((e) => e.entityId),
  );
  const invalid = brief && program.sessions.some((s) => s.entity && !allowed.has(s.entity.id));
  const hasMain = program.sessions.some((s) => s.entityRef === program.bridgeRef && s.entity);
  const existingVenueConflict =
    settings.venue === "existing" &&
    program.sessions.some((s) => {
      if (s.entity?.domain !== "place") return false;
      const escaped = s.entity.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`\\b(?:meet|gather|visit|travel) (?:at |to )?${escaped}`, "i").test(
        s.activity,
      );
    });
  return [
    {
      id: "evidence",
      label: "Cultural references",
      status: changed || invalid || !hasMain || guard.warnings.length ? "conflict" : "satisfied",
      detail: `${anchored} of ${program.sessions.length} sessions have a Qloo entity anchor. ${changed ? `${changed} unsupported references were removed; review the wording.` : "Other activities are the agent’s proposals. Affinity does not guarantee attendance."}`,
    },
    {
      id: "venue",
      label: "Venue, capacity & permissions",
      status: existingVenueConflict ? "conflict" : "confirm",
      detail: existingVenueConflict
        ? "The draft asks participants to visit a recommended place even though you selected an existing venue. Adapt that session to happen in your room before proceeding."
        : settings.venue === "existing"
          ? `Confirm your venue${settings.venueName ? ` (${settings.venueName})` : ""} can accommodate the activities${settings.groupSize ? ` and ${settings.groupSize} people` : ""}.`
          : "Contact any proposed venues. Group access, capacity, availability and permission have not been checked.",
    },
    {
      id: "budget",
      label: settings.budget === "free" ? "Free to participants" : "Costs & materials",
      status: "confirm",
      detail:
        settings.budget === "free"
          ? "Free participation is a requirement, not a verified booking. Confirm entry, materials and transport are covered or choose the no-purchase alternative."
          : "Agree a budget and check entry, materials, media and transport costs before inviting participants.",
    },
    {
      id: "access",
      label: "Access & audience suitability",
      status: "confirm",
      detail: `${settings.audience === "all_ages" ? "Review every activity and media selection for under-18s. " : "Review the activities with both groups. "}${settings.access || "Check mobility, language, captions, timing and device access with participants."}`,
    },
    {
      id: "media",
      label: "Media & recording",
      status: "confirm",
      detail:
        "Arrange lawful access to any media, permission for recording, and a non-recording alternative.",
    },
  ];
}
