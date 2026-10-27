import { carId, squash } from "./car-id";
import {
  BODY_ALIASES,
  BODY_TYPE_LABELS,
  FUEL_ALIASES,
  FUEL_TYPE_LABELS,
  PRIORITY_LABELS,
  USAGE_LABELS,
  USAGE_WEIGHT_NUDGES,
  type FinderCandidate,
  type FinderPreferences,
  type FinderPriority,
} from "./finder-data";

/**
 * Smart Car Finder — deterministic parsing + scoring layer.
 *
 * The AI stage only proposes candidates; every number used here is parsed from
 * the candidate's verbatim spec strings. Cars whose price can't be verified, or
 * whose data is missing for a chosen priority, are EXCLUDED (with a reason)
 * instead of being scored with guessed values.
 *
 * Browser-safe and unit-testable (no server-only imports).
 */

const NA = "Not Available";

export type ParsedMetrics = {
  priceLakh: { min: number; max: number } | null;
  hp: number | null;
  torqueNm: number | null;
  accelSec: number | null;
  efficiency: { value: number; ev: boolean } | null;
  safetyStars: number | null;
  comfort: number | null;
  luxury: number | null;
  reliability: number | null;
};

// ---------- parsers ---------------------------------------------------------

/**
 * Parses an India ex-showroom price string into a lakh range.
 * Understands "Rs 8.1 - 12.5 lakh", "Rs 2.1 - 4.2 crore", "₹ 8,90,000".
 * Non-INR currencies and unparseable strings return null (price unverified).
 */
export function parsePriceLakh(raw: string | null | undefined): { min: number; max: number } | null {
  if (!raw || raw.trim() === NA) return null;
  const s = raw.toLowerCase().replace(/,/g, "");
  // Only India ex-showroom prices (INR) count as verified for the budget filter.
  if (/\$|usd|€|£|euro|pound|aed|dirham|won|yen/.test(s)) return null;
  const crore = /crore|\bcr\b/.test(s);
  const scale = crore ? 100 : 1;

  const rawNums = [...s.matchAll(/\d+(?:\.\d+)?/g)].map((m) => parseFloat(m[0]));
  // Drop bare model years (e.g. "2024 model, Rs 8.5 lakh").
  const noYears = rawNums.filter((n) => !(Number.isInteger(n) && n >= 1900 && n <= 2100));
  const scaled = noYears
    .map((n) => n * scale)
    .map((n) => (n >= 10000 ? n / 100000 : n)) // absolute rupees → lakh
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 2000);
  if (!scaled.length) return null;
  return { min: Math.min(...scaled), max: Math.max(...scaled) };
}

export function parseAccelSec(raw: string | null | undefined): number | null {
  if (!raw || raw.trim() === NA) return null;
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(?:s\b|sec|second)/i) ?? raw.match(/(\d+(?:\.\d+)?)/);
  const n = m ? parseFloat(m[1]) : null;
  return n !== null && n > 0.5 && n < 60 ? n : null;
}

/** Mileage km/l / km/kg, or EV range in km (ev: true). */
export function parseEfficiency(
  raw: string | null | undefined,
): { value: number; ev: boolean } | null {
  if (!raw || raw.trim() === NA) return null;
  const s = raw.toLowerCase();
  const kmpl = s.match(/(\d+(?:\.\d+)?)\s*(?:km\/l|kmpl|km\/kg|kmpkg)/);
  if (kmpl) {
    const v = parseFloat(kmpl[1]);
    if (v > 0 && v <= 150) return { value: v, ev: false };
  }
  const rng = s.match(/(\d+(?:\.\d+)?)\s*km/);
  if (rng) {
    const v = parseFloat(rng[1]);
    if (v > 20 && v <= 2000) return { value: v, ev: true };
  }
  return null;
}

export function parseSafetyStars(raw: string | null | undefined): number | null {
  if (!raw || raw.trim() === NA) return null;
  const m = raw.match(/(\d)\s*[-\s]?(?:star|★)/i) ?? raw.match(/\b([1-5])\s*\/\s*5\b/);
  const n = m ? parseInt(m[1], 10) : null;
  return n !== null && n >= 1 && n <= 5 ? n : null;
}

export function parseRating(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) && raw >= 0 && raw <= 10 ? raw : null;
  if (typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s || s === NA) return null;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return n >= 0 && n <= 10 ? n : null;
}

function firstNumber(raw: string | null | undefined, max: number): number | null {
  if (!raw || raw.trim() === NA) return null;
  const m = raw.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n > 0 && n <= max ? n : null;
}

export function parseMetrics(c: FinderCandidate): ParsedMetrics {
  return {
    priceLakh: parsePriceLakh(c.priceRange),
    hp: firstNumber(c.horsepower, 3000),
    torqueNm: firstNumber(c.torque, 6000),
    accelSec: parseAccelSec(c.zeroToHundred),
    efficiency: parseEfficiency(c.fuelEconomyOrRange),
    safetyStars: parseSafetyStars(c.safety),
    comfort: parseRating(c.comfortRating),
    luxury: parseRating(c.luxuryRating),
    reliability: parseRating(c.reliabilityRating),
  };
}

// ---------- filter helpers --------------------------------------------------

export function bodyMatches(bodyType: string, key: string): boolean {
  if (!key) return true;
  const t = squash(bodyType ?? "");
  return (BODY_ALIASES[key] ?? []).some((a) => t.includes(squash(a)));
}

export function fuelMatches(fuelType: string, key: string): boolean {
  if (!key) return true;
  const t = squash(fuelType ?? "");
  return (FUEL_ALIASES[key] ?? []).some((a) => t.includes(squash(a)));
}

// ---------- result shapes ---------------------------------------------------

export type ScoredDimension = {
  key: FinderPriority;
  label: string;
  /** 0-100 for this dimension */
  score: number;
  /** human-readable detail from the car's own verified strings */
  detail: string;
};

export type ScoredMatch = {
  id: string;
  rank: number;
  name: string;
  brand: string;
  matchScore: number; // 0-100
  priceLabel: string;
  bodyType: string;
  fuelType: string;
  modelYear: string;
  seatingCapacity: string;
  specs: {
    fuelEconomyOrRange: string;
    horsepower: string;
    zeroToHundred: string;
    safety: string;
    torque: string;
  };
  dimensions: ScoredDimension[];
  why: string[];
  highlight: string;
};

export type ExcludedCar = { name: string; reason: string };

export type FinderResult = {
  matches: ScoredMatch[];
  excluded: ExcludedCar[];
  /** how many distinct AI candidates were checked */
  checkedCount: number;
};

// ---------- scoring ---------------------------------------------------------

/** Min-max normalize each value across the pool; missing values stay null. */
function normalizedScores(values: (number | null)[], higherBetter: boolean): (number | null)[] {
  const nums = values.filter((v): v is number => v != null);
  if (!nums.length) return values.map(() => null);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return values.map((v) => {
    if (v == null) return null;
    if (max === min) return 75;
    const t = higherBetter ? (v - min) / (max - min) : (max - v) / (max - min);
    return Math.round(t * 100);
  });
}

function computeWeights(prefs: FinderPreferences): { key: FinderPriority; weight: number }[] {
  const nudges = USAGE_WEIGHT_NUDGES[prefs.usage] ?? {};
  const raw = prefs.priorities.map((key) => ({ key, weight: nudges[key] ?? 1 }));
  const sum = raw.reduce((a, b) => a + b.weight, 0);
  return raw.map((r) => ({ key: r.key, weight: r.weight / sum }));
}

function hardFilterReason(
  m: ParsedMetrics,
  c: FinderCandidate,
  prefs: FinderPreferences,
): string | null {
  if (!m.priceLakh) {
    return "Price could not be verified, so it can't be checked against your budget";
  }
  if (m.priceLakh.min > prefs.budgetMaxLakh + 0.01) {
    return `Above your budget (${c.priceRange})`;
  }
  if (m.priceLakh.max < prefs.budgetMinLakh - 0.01) {
    return `Below your budget range (${c.priceRange})`;
  }
  if (prefs.bodyType && !bodyMatches(c.bodyType, prefs.bodyType)) {
    return `Not a ${BODY_TYPE_LABELS[prefs.bodyType] ?? prefs.bodyType} (listed as ${c.bodyType})`;
  }
  if (prefs.fuelType && !fuelMatches(c.fuelType, prefs.fuelType)) {
    return `Not a ${FUEL_TYPE_LABELS[prefs.fuelType] ?? prefs.fuelType} (listed as ${c.fuelType})`;
  }
  return null;
}

function missingDataReason(m: ParsedMetrics, prefs: FinderPreferences): string | null {
  const has = (k: FinderPriority) => prefs.priorities.includes(k);
  if (has("efficiency") && !m.efficiency) return "Fuel efficiency / range data unavailable";
  if (has("performance") && m.hp == null) return "Horsepower data unavailable";
  if (has("safety") && m.safetyStars == null) return "Safety rating data unavailable";
  if (has("comfort") && m.comfort == null) return "Comfort rating unavailable";
  if (has("luxury") && m.luxury == null) return "Luxury rating unavailable";
  if (has("reliability") && m.reliability == null) return "Reliability rating unavailable";
  if (has("value") && m.hp == null && !m.efficiency) {
    return "Not enough specification data to judge value for money";
  }
  return null;
}

function whyFor(
  key: FinderPriority,
  c: FinderCandidate,
  m: ParsedMetrics,
  score: number,
  isBest: boolean,
  prefs: FinderPreferences,
): string {
  const usageLabel = (USAGE_LABELS[prefs.usage] ?? "").toLowerCase();
  switch (key) {
    case "efficiency": {
      const v = m.efficiency
        ? m.efficiency.ev
          ? `${m.efficiency.value} km electric range`
          : `${m.efficiency.value} km/l`
        : "";
      return `${isBest ? "Best efficiency in the shortlist" : "Good fuel efficiency"} (${v})`;
    }
    case "performance":
      return `${isBest ? "Strongest performance in the shortlist" : "Strong performance"} (${c.horsepower}${c.zeroToHundred !== NA ? `, 0-100 in ${c.zeroToHundred}` : ""})`;
    case "safety":
      return `${isBest ? "Best safety credentials in the shortlist" : "Strong safety credentials"} (${c.safety})`;
    case "comfort":
      return `${isBest ? "Most comfortable in the shortlist" : "Comfortable cabin and ride"} (rated ${m.comfort}/10) — suits ${usageLabel}`;
    case "luxury":
      return `${isBest ? "Most luxurious in the shortlist" : "Premium, upmarket feel"} (rated ${m.luxury}/10)`;
    case "reliability":
      return `${isBest ? "Most dependable in the shortlist" : "Dependable ownership record"} (rated ${m.reliability}/10)`;
    case "value":
      return `${isBest ? "Best specs-per-rupee in the shortlist" : "Excellent capability for the price"} (${c.priceRange})`;
  }
}

/**
 * Scores AI-proposed candidates against the user's preferences.
 * Order: hard filters → data-availability exclusions → transparent scoring.
 */
export function scoreFinderCandidates(
  candidates: FinderCandidate[],
  prefs: FinderPreferences,
): FinderResult {
  // Dedupe by stable car id — one identity per vehicle.
  const seen = new Set<string>();
  const items = candidates
    .filter((c) => {
      const id = carId(c.name);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((c) => ({ c, id: carId(c.name), m: parseMetrics(c) }));

  const excluded: ExcludedCar[] = [];
  const pool = items.filter((it) => {
    const reason = hardFilterReason(it.m, it.c, prefs);
    if (reason) {
      excluded.push({ name: it.c.name, reason });
      return false;
    }
    return true;
  });
  const kept = pool.filter((it) => {
    const reason = missingDataReason(it.m, prefs);
    if (reason) {
      excluded.push({ name: it.c.name, reason });
      return false;
    }
    return true;
  });

  const n = kept.length;
  if (n === 0) return { matches: [], excluded, checkedCount: items.length };

  // Cross-pool normalized parts.
  const hpScores = normalizedScores(kept.map((it) => it.m.hp), true);
  const accScores = normalizedScores(kept.map((it) => it.m.accelSec), false);
  const tqScores = normalizedScores(kept.map((it) => it.m.torqueNm), true);
  const safetyScores = kept.map((it) => (it.m.safetyStars != null ? (it.m.safetyStars / 5) * 100 : null));

  // Efficiency: normalize within fuel-group (km/l vs EV range) separately.
  const effGroupOf = kept.map((it) => (it.m.efficiency?.ev ? "ev" : "fuel"));
  const effScores: (number | null)[] = kept.map(() => null);
  for (const group of ["fuel", "ev"] as const) {
    const idx = kept.map((_, i) => i).filter((i) => effGroupOf[i] === group && kept[i].m.efficiency);
    if (!idx.length) continue;
    if (idx.length === 1) {
      effScores[idx[0]] = 80;
    } else {
      const vals = idx.map((i) => kept[i].m.efficiency!.value);
      const sub = normalizedScores(vals, true);
      idx.forEach((i, j) => (effScores[i] = sub[j]));
    }
  }

  // Performance: blend available parts (hp .45 / accel .35 / torque .2).
  const perfScores: (number | null)[] = kept.map((_, i) => {
    const parts: [number, number][] = [];
    if (hpScores[i] != null) parts.push([0.45, hpScores[i] as number]);
    if (accScores[i] != null) parts.push([0.35, accScores[i] as number]);
    if (tqScores[i] != null) parts.push([0.2, tqScores[i] as number]);
    if (!parts.length) return null;
    const wsum = parts.reduce((a, [w]) => a + w, 0);
    return Math.round(parts.reduce((a, [w, s]) => a + w * s, 0) / wsum);
  });

  // Value: capability points per lakh, normalized across the pool.
  const capability = kept.map((_, i) => {
    const parts: [number, number][] = [];
    if (hpScores[i] != null) parts.push([0.4, hpScores[i] as number]);
    if (effScores[i] != null) parts.push([0.35, effScores[i] as number]);
    if (safetyScores[i] != null) parts.push([0.25, safetyScores[i] as number]);
    if (!parts.length) return null;
    const wsum = parts.reduce((a, [w]) => a + w, 0);
    return parts.reduce((a, [w, s]) => a + w * s, 0) / wsum;
  });
  const perLakh = kept.map((it, i) => {
    const mid = (it.m.priceLakh!.min + it.m.priceLakh!.max) / 2;
    return capability[i] != null ? (capability[i] as number) / Math.max(mid, 0.5) : null;
  });
  const valueScores = normalizedScores(perLakh, true);

  const ratings: Record<string, (number | null)[]> = {
    comfort: kept.map((it) => (it.m.comfort != null ? it.m.comfort * 10 : null)),
    luxury: kept.map((it) => (it.m.luxury != null ? it.m.luxury * 10 : null)),
    reliability: kept.map((it) => (it.m.reliability != null ? it.m.reliability * 10 : null)),
  };

  const weights = computeWeights(prefs);

  const matches: ScoredMatch[] = kept.map((it, i) => {
    const dimensionScore = (key: FinderPriority): number | null => {
      switch (key) {
        case "efficiency":
          return effScores[i];
        case "performance":
          return perfScores[i];
        case "safety":
          return safetyScores[i];
        case "comfort":
          return ratings.comfort[i];
        case "luxury":
          return ratings.luxury[i];
        case "reliability":
          return ratings.reliability[i];
        case "value":
          return valueScores[i];
      }
    };

    const selected = weights.map((w) => {
      const score = dimensionScore(w.key) ?? 75; // defensively neutral
      return { ...w, score };
    });
    const matchScore = Math.round(selected.reduce((a, s) => a + s.weight * s.score, 0));

    const dims: ScoredDimension[] = selected.map((s) => ({
      key: s.key,
      label: PRIORITY_LABELS[s.key],
      score: s.score,
      detail: "",
    }));

    const bestOf = (key: FinderPriority) =>
      selected.filter((s) => s.key === key).length > 0 &&
      selected.find((s) => s.key === key)!.score >= 90 &&
      n > 1;

    const why = prefs.priorities
      .map((key) => ({ key, weighted: selected.find((s) => s.key === key)!.weight * (selected.find((s) => s.key === key)!.score || 0) }))
      .sort((a, b) => b.weighted - a.weighted)
      .slice(0, 2)
      .map(({ key }) => whyFor(key, it.c, it.m, selected.find((s) => s.key === key)!.score, bestOf(key), prefs));
    why.unshift(`Fits your ₹${prefs.budgetMinLakh}–${prefs.budgetMaxLakh} lakh budget (${it.c.priceRange})`);

    return {
      id: it.id,
      rank: 0,
      name: it.c.name,
      brand: it.c.brand,
      matchScore,
      priceLabel: it.c.priceRange,
      bodyType: it.c.bodyType,
      fuelType: it.c.fuelType,
      modelYear: it.c.modelYear,
      seatingCapacity: it.c.seatingCapacity,
      specs: {
        fuelEconomyOrRange: it.c.fuelEconomyOrRange,
        horsepower: it.c.horsepower,
        zeroToHundred: it.c.zeroToHundred,
        safety: it.c.safety,
        torque: it.c.torque,
      },
      dimensions: dims,
      why,
      highlight: it.c.highlight === NA ? "" : it.c.highlight,
    };
  });

  matches.sort((a, b) => b.matchScore - a.matchScore || a.name.localeCompare(b.name));
  matches.forEach((m, i) => (m.rank = i + 1));

  return { matches, excluded, checkedCount: items.length };
}
