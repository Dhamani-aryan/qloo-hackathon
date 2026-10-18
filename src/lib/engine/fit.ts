import { DEFAULT_SETTINGS, type PlanningSettings } from "@/lib/planning";
import type { ScoredCandidate } from "./types";

export interface ActivityFit {
  level: "good" | "conditional";
  reason: string;
  confirmations: string[];
}

/** Product interpretation of retrieved metadata, deliberately separate from cultural affinity. */
export function assessActivityFit(c: ScoredCandidate, settings = DEFAULT_SETTINGS): ActivityFit {
  const confirmations: string[] = [];
  const isPlace = c.domain === "place";
  const categories = c.entity.tags
    .filter((t) => /:(genre|category):/.test(t.id))
    .map((t) => `${t.name ?? ""} ${t.id.split(":").pop()?.replace(/_/g, " ") ?? ""}`)
    .join(" ");
  const workshopSpace =
    /\b(librar(y|ies)|community cent(re|er)|workshops?|art studios?|museums?|galler(y|ies)|parks?)\b/i.test(
      categories,
    );
  if (isPlace) confirmations.push("Confirm group access, permission, opening hours and capacity.");
  if (isPlace && settings.budget === "free")
    confirmations.push(
      "Confirm zero-cost access or use a free alternative; Qloo does not verify admission prices.",
    );
  if (!isPlace && ["movie", "tvShow", "artist", "book", "videoGame"].includes(c.domain))
    confirmations.push("Arrange lawful access to any media and an accessible alternative.");
  if (settings.access) confirmations.push(`Check the organizer's access needs: ${settings.access}`);
  if (settings.venue === "existing" && isPlace)
    return {
      level: "conditional",
      reason:
        "Use as a cultural reference at your existing venue; an outing is not part of the brief.",
      confirmations,
    };
  const suitable: Record<PlanningSettings["activity"], boolean> = {
    mixed: !isPlace || workshopSpace,
    watch: c.domain === "movie" || c.domain === "tvShow",
    listen: c.domain === "artist" || c.domain === "podcast",
    make: !isPlace || workshopSpace,
    explore: isPlace,
    play: c.domain === "videoGame",
  };
  return {
    level: suitable[settings.activity] ? "good" : "conditional",
    reason: suitable[settings.activity]
      ? "A plausible starting point for your activity. This is an activity-fit judgment, not verified availability."
      : isPlace
        ? "Culturally relevant, but its suitability for a group session is unverified. Consider a reference-based activity elsewhere."
        : "Cultural support is promising; adapt the activity format before building a program around it.",
    confirmations,
  };
}
