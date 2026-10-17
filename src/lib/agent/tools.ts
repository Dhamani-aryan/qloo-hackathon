import type { PlaceTheme } from "@/lib/engine/context";
import type { QlooClient } from "@/lib/qloo";

/**
 * Turn a theme word ("jazz club", "food") into a Qloo place tag. Place-type tags
 * (`urn:tag:genre:place:*`, `urn:tag:category:place:*`) narrow discovery to real venue types;
 * offering-style tags ("Food" as a menu item) match too broadly, so they are a last resort.
 */
export async function findPlaceTheme(qloo: QlooClient, query: string): Promise<PlaceTheme | null> {
  const tags = await qloo.searchTags({ query, parentTypes: ["urn:entity:place"], take: 8 });
  const rank = (type: string | null) =>
    type === "urn:tag:genre:place" ? 0 : type === "urn:tag:category:place" ? 1 : 2;
  const best = [...tags]
    // Hotel and restaurant sub-genres ("…:hotel:food") describe amenities, not venues.
    .filter((t) => !/:place:(hotel|restaurant):/.test(t.id))
    .sort((x, y) => rank(x.type) - rank(y.type))[0];
  return best ? { tagId: best.id, name: best.name } : null;
}
