import type { QlooEntity } from "@/lib/qloo";
import { normalizeName } from "./resolve";
import type { DomainKey } from "./types";

/**
 * Candidate filters required by the spike (docs/SPIKE_FINDINGS.md) and the
 * responsible-use rules (plan §15). They return a human-readable rejection reason or null.
 *
 * Only an entity's NAME and its classifying tags (genre / subgenre / category) are checked.
 * Qloo attaches many incidental tags (amenities such as "wheelchair accessible parking lot",
 * nearby attractions, loose themes such as "spirituality" on a singer), and matching those
 * rejected Jazz at Lincoln Center and Weyes Blood in the first live run.
 */

/** Works whose subject is religion or politics are out of scope for program bridges. */
const SENSITIVE =
  /\b(relig\w*|spiritual\w*|hindu\w*|hindutva|islam\w*|muslim\w*|christian\w*|jesus|bible|quran|koran|atheis\w*|theolog\w*|polit\w*|democra\w*|elections?|nationalis\w*|caste|kashmir\w*|propaganda)\b/i;

/**
 * Places that can't host a community program:
 * - lodging and event halls (spike: Jaipur);
 * - places of worship (religion is out of scope, plan §15);
 * - alcohol-centred venues, since mixed groups may include under-21s (evaluation: a sake brewery
 *   in Toronto, a nightclub in Jaipur);
 * - government buildings (evaluation: the Palace of Westminster in London).
 */
const UNSUITABLE_VENUE =
  /\b(hotels?|motels?|hostels?|lodging|resorts?|banquets?|wedding venues?|marriage hall|guest ?house|bed (and |& )?breakfast|condominium|serviced apartments?|extended stay|holiday home|hyatt|marriott|hilton|oyo|church|cathedral|chapel|mosque|masjid|temple|synagogue|gurdwara|place of worship|brewer(y|ies)|winer(y|ies)|distiller(y|ies)|brewpub|taproom|sake|beer garden|wine bar|cocktail bar|night ?clubs?|pubs?|bars?|liquor|parliament|palace of westminster|capitol|city hall|town hall|courthouse|embassy|consulate|government)\b/i;

/** Retail bundles rather than single works (evaluation: "… Collection 6 Books Set (…)"). */
const BUNDLE =
  /\b(box(ed)? ?sets?|books? sets?|\d+[ -]books?|complete collection|collection set)\b/i;

const CLASSIFYING_TAG = /:(genre|subgenre|category):/;

function haystack(e: QlooEntity, tagFilter: RegExp): string {
  const tags = e.tags.filter((t) => tagFilter.test(t.id));
  return [e.name, ...tags.flatMap((t) => [t.id.split(":").pop() ?? "", t.name ?? ""])]
    .join(" ")
    .replace(/_/g, " ");
}

export function sensitiveReason(e: QlooEntity): string | null {
  const match = haystack(e, CLASSIFYING_TAG).match(SENSITIVE);
  return match
    ? `Sensitive topic (${match[0].toLowerCase()}): excluded by responsible-use rules`
    : null;
}

export function venueReason(e: QlooEntity): string | null {
  const match = haystack(e, /:(category|genre):place/).match(UNSUITABLE_VENUE);
  return match ? `Unsuitable venue for a program (${match[0].toLowerCase()})` : null;
}

export function bundleReason(e: QlooEntity): string | null {
  return BUNDLE.test(e.name) ? "A bundle or box set, not a single work" : null;
}

/** A place named just like the scenario's city reads as the city itself (evaluation: a café called "Chicago"). */
export function sameAsCityReason(
  e: QlooEntity,
  location: string | null | undefined,
): string | null {
  if (!location) return null;
  const name = normalizeName(e.name);
  const city = normalizeName(location);
  return name.length > 2 && (name === city || city.startsWith(name))
    ? "Shares its name with the city, which would confuse participants"
    : null;
}

export function rejectionReason(
  e: QlooEntity,
  domain: DomainKey,
  location?: string | null,
): string | null {
  return (
    sensitiveReason(e) ??
    bundleReason(e) ??
    (domain === "place" ? (venueReason(e) ?? sameAsCityReason(e, location)) : null)
  );
}

/** Tag-level variant for Compare themes. */
export function isSensitiveTag(name: string, id: string): boolean {
  return SENSITIVE.test(`${name} ${id.replace(/[_:]/g, " ")}`);
}
