import type { QlooEntity } from "@/lib/qloo";
import type { DomainKey } from "./types";

/**
 * Candidate filters required by the spike (docs/SPIKE_FINDINGS.md) and the
 * responsible-use rules (plan §15). They return a human-readable rejection reason or null.
 */

/** Religion and politics are out of scope for program bridges. */
const SENSITIVE =
  /\b(relig\w*|spiritual\w*|hindu\w*|hindutva|islam\w*|muslim\w*|christian\w*|jesus|bible|quran|koran|atheis\w*|theolog\w*|polit\w*|democra\w*|elections?|nationalis\w*|caste|kashmir\w*|propaganda)\b/i;

/** Places that can't host a community program (spike: hotels and banquet halls surfaced in Jaipur). */
const UNSUITABLE_VENUE =
  /\b(hotels?|motels?|hostels?|lodging|resorts?|banquets?|wedding|marriage hall|guest ?house|serviced apartments?|hyatt|marriott|hilton|airbnb|gas station|car wash|parking)\b/i;

function haystack(e: QlooEntity): string {
  return [e.name, e.subtype ?? "", ...e.tags.flatMap((t) => [t.id, t.name ?? ""])]
    .join(" ")
    .replace(/[_:]/g, " ");
}

export function sensitiveReason(e: QlooEntity): string | null {
  const match = haystack(e).match(SENSITIVE);
  return match
    ? `Sensitive topic (${match[0].toLowerCase()}): excluded by responsible-use rules`
    : null;
}

export function venueReason(e: QlooEntity): string | null {
  const match = haystack(e).match(UNSUITABLE_VENUE);
  return match ? `Unsuitable venue for a program (${match[0].toLowerCase()})` : null;
}

export function rejectionReason(e: QlooEntity, domain: DomainKey): string | null {
  return sensitiveReason(e) ?? (domain === "place" ? venueReason(e) : null);
}

/** Tag-level variant for Compare themes. */
export function isSensitiveTag(name: string, id: string): boolean {
  return SENSITIVE.test(`${name} ${id.replace(/[_:]/g, " ")}`);
}
