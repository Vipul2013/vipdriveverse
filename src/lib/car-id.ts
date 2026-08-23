/**
 * Central car identity helpers.
 * Every car in VIP DriveVerse is identified by a stable slug derived from its
 * canonical name. Search, details, compare, rankings and links all use it.
 * Browser-safe (no server-only imports).
 */

const BRAND_ALIASES: string[][] = [
  ["maruti", "suzuki", "marutisuzuki"],
  ["mercedes", "benz", "mercedesbenz", "merc"],
  ["vw", "volkswagen"],
  ["chevy", "chevrolet"],
  ["rangerover", "landrover", "land", "rover"],
  ["rr", "rollsroyce", "rolls", "royce"],
  ["mahindra", "mahindraandmahindra"],
];

const STOPWORDS = new Set([
  "car", "cars", "the", "new", "latest", "model", "price", "specs", "india", "and",
]);

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Stable unique id for a car, derived from its canonical name. */
export function carId(name: string): string {
  return normalize(name).replace(/ /g, "-");
}

/** Human-friendly label from an id (fallback when a name isn't loaded yet). */
export function idToQuery(id: string): string {
  return id.replace(/-/g, " ").trim();
}

function aliasGroup(token: string): string[] | null {
  return BRAND_ALIASES.find((g) => g.includes(token)) ?? null;
}

/**
 * Strict identity check: does `name` really represent the car the user asked for?
 * Every meaningful token of the query must be present in the candidate name
 * (brand tokens may be satisfied by a known alias). This is what stops
 * "Mahindra XUV 7XO" from silently resolving to "Mahindra XUV 3XO".
 */
export function identityMatches(query: string, name: string): boolean {
  const q = normalize(query);
  const n = normalize(name);
  if (!q || !n) return false;
  if (q === n) return true;

  const nSquash = squash(name);
  const tokens = q.split(" ").filter((t) => t && !STOPWORDS.has(t));
  if (tokens.length === 0) return false;

  for (const t of tokens) {
    if (nSquash.includes(t)) continue;
    const group = aliasGroup(t);
    if (group && group.some((a) => nSquash.includes(a))) continue;
    // allow single trailing letters/short trims to be dropped by the model
    if (t.length <= 1) continue;
    return false;
  }
  return true;
}
