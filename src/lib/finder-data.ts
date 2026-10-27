import { z } from "zod";

/**
 * Smart Car Finder — shared option lists, preference schema and candidate type.
 * Browser-safe (no server-only imports).
 */

export const BODY_TYPES = [
  { key: "hatchback", label: "Hatchback" },
  { key: "sedan", label: "Sedan" },
  { key: "suv", label: "SUV" },
  { key: "mpv", label: "MPV" },
  { key: "coupe", label: "Coupe" },
  { key: "sports", label: "Sports Car" },
  { key: "convertible", label: "Convertible" },
  { key: "pickup", label: "Pickup" },
  { key: "wagon", label: "Estate / Wagon" },
] as const;

export const FUEL_TYPES = [
  { key: "petrol", label: "Petrol" },
  { key: "diesel", label: "Diesel" },
  { key: "cng", label: "CNG" },
  { key: "hybrid", label: "Hybrid" },
  { key: "electric", label: "Electric" },
  { key: "hydrogen", label: "Hydrogen" },
] as const;

export const PRIORITIES = [
  { key: "efficiency", label: "Fuel Efficiency" },
  { key: "performance", label: "Performance" },
  { key: "safety", label: "Safety" },
  { key: "comfort", label: "Comfort" },
  { key: "luxury", label: "Luxury" },
  { key: "reliability", label: "Reliability" },
  { key: "value", label: "Value for Money" },
] as const;

export const USAGES = [
  { key: "city", label: "City Driving" },
  { key: "highway", label: "Highway Driving" },
  { key: "family", label: "Family Use" },
  { key: "mixed", label: "Mixed Use" },
] as const;

export type BodyTypeKey = (typeof BODY_TYPES)[number]["key"];
export type FuelTypeKey = (typeof FUEL_TYPES)[number]["key"];
export type FinderPriority = (typeof PRIORITIES)[number]["key"];
export type UsageKey = (typeof USAGES)[number]["key"];

export const BODY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  BODY_TYPES.map((b) => [b.key, b.label]),
);
export const FUEL_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  FUEL_TYPES.map((f) => [f.key, f.label]),
);
export const PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  PRIORITIES.map((p) => [p.key, p.label]),
);
export const USAGE_LABELS: Record<string, string> = Object.fromEntries(
  USAGES.map((u) => [u.key, u.label]),
);

/** Aliases accepted inside a candidate's bodyType string (squash-compared). */
export const BODY_ALIASES: Record<string, string[]> = {
  hatchback: ["hatchback"],
  sedan: ["sedan", "saloon"],
  suv: ["suv", "crossover"],
  mpv: ["mpv", "muv", "minivan"],
  coupe: ["coupe"],
  sports: ["sports", "roadster", "targa", "supercar", "hypercar", "coupe"],
  convertible: ["convertible", "cabriolet", "roadster", "spyder"],
  pickup: ["pickup", "double cab", "single cab"],
  wagon: ["estate", "wagon", "tourer"],
};

/** Aliases accepted inside a candidate's fuelType string (squash-compared). */
export const FUEL_ALIASES: Record<string, string[]> = {
  petrol: ["petrol"],
  diesel: ["diesel"],
  cng: ["cng"],
  hybrid: ["hybrid", "hev", "phev", "mildhybrid"],
  electric: ["electric", "bev"],
  hydrogen: ["hydrogen", "fuelcell"],
};

/** Usage nudges relevant priority weights (transparent, shown in the UI). */
export const USAGE_WEIGHT_NUDGES: Record<UsageKey, Partial<Record<FinderPriority, number>>> = {
  city: { efficiency: 1.5, comfort: 1.2 },
  highway: { performance: 1.4, comfort: 1.1 },
  family: { safety: 1.5, comfort: 1.4 },
  mixed: {},
};

export type FinderPreferences = {
  budgetMinLakh: number;
  budgetMaxLakh: number;
  /** "" = any body type, otherwise a BodyTypeKey */
  bodyType: string;
  /** "" = any fuel, otherwise a FuelTypeKey */
  fuelType: string;
  priorities: FinderPriority[];
  usage: UsageKey;
};

export const FINDER_PREFERENCE_KEYS = PRIORITIES.map((p) => p.key) as [
  FinderPriority,
  ...FinderPriority[],
];

export const FinderPreferencesSchema = z
  .object({
    budgetMinLakh: z.number().min(0).max(10000),
    budgetMaxLakh: z.number().min(0).max(10000),
    bodyType: z.string().max(20),
    fuelType: z.string().max(20),
    priorities: z.array(z.enum(FINDER_PREFERENCE_KEYS)).min(1).max(PRIORITIES.length),
    usage: z.enum(["city", "highway", "family", "mixed"]),
  })
  .refine((d) => d.budgetMaxLakh >= d.budgetMinLakh, {
    message: "Budget upper limit must be at least the lower limit",
  });

/**
 * One candidate car proposed by the AI shortlist stage. Every string field is a
 * verbatim specification value (or "Not Available") — never an invented number.
 */
export type FinderCandidate = {
  name: string;
  brand: string;
  modelYear: string;
  bodyType: string;
  country: string;
  fuelType: string;
  priceRange: string;
  horsepower: string;
  torque: string;
  zeroToHundred: string;
  fuelEconomyOrRange: string;
  seatingCapacity: string;
  safety: string;
  comfortRating: number | null;
  luxuryRating: number | null;
  reliabilityRating: number | null;
  highlight: string;
};
