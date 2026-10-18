import { z } from "zod";

/** Explicit organizer choices. Unknown details stay unknown rather than becoming invented facts. */
export const PlanningSettingsSchema = z.object({
  activity: z.enum(["mixed", "watch", "listen", "make", "explore", "play"]).default("mixed"),
  novelty: z.enum(["familiar", "balanced", "exploratory"]).default("balanced"),
  budget: z.enum(["unspecified", "free", "paid"]).default("unspecified"),
  audience: z.enum(["unspecified", "all_ages", "adults"]).default("unspecified"),
  groupSize: z.number().int().min(2).max(500).nullable().default(null),
  venue: z.enum(["flexible", "existing", "outing"]).default("flexible"),
  venueName: z.string().trim().max(160).default(""),
  access: z.string().trim().max(300).default(""),
});
export type PlanningSettings = z.infer<typeof PlanningSettingsSchema>;
export const DEFAULT_SETTINGS: PlanningSettings = PlanningSettingsSchema.parse({});

export const ACTIVITY_LABELS: Record<PlanningSettings["activity"], string> = {
  mixed: "A mix of activities",
  watch: "Watch & discuss",
  listen: "Listen & share",
  make: "Make something together",
  explore: "Explore the city",
  play: "Play & collaborate",
};

export function settingsInstructions(settings: PlanningSettings): string[] {
  const rules: string[] = [];
  if (settings.activity !== "mixed") rules.push(`Activity: ${ACTIVITY_LABELS[settings.activity]}.`);
  if (settings.budget === "free")
    rules.push(
      "Every session must be free to participants. Do not assume free entry or sponsorship; flag any unconfirmed cost and provide a no-purchase alternative.",
    );
  if (settings.groupSize)
    rules.push(`Plan for ${settings.groupSize} participants; capacity is unverified.`);
  if (settings.venue === "existing")
    rules.push(
      `Use the organizer's existing venue${settings.venueName ? ` (${settings.venueName})` : ""}. Do not require outings.`,
    );
  if (settings.venue === "outing")
    rules.push("Outings are welcome; confirm access, travel and permissions before scheduling.");
  if (settings.access) rules.push(`Access requirements: ${settings.access}`);
  if (settings.audience === "all_ages")
    rules.push(
      "Mixed-age participants, including under-18s: age-appropriate activities and daytime sessions.",
    );
  if (settings.audience === "adults") rules.push("All participants are adults.");
  return rules;
}
