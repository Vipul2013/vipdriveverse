import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import type { FinderCandidate, FinderPreferences } from "./finder-data";

/**
 * Smart Car Finder — AI shortlist stage.
 *
 * The AI only PROPOSES candidate cars matching the user's hard filters. It must
 * never invent a car, price, specification or rating; anything unverifiable is
 * "Not Available" (or null) and the deterministic scoring layer in
 * finder-scoring.ts then verifies, excludes and ranks.
 */

const NA = "Not Available";

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY — enable Lovable Cloud / AI to provision it.");
  return createLovableAiGatewayProvider(key)("google/gemini-3-flash-preview");
}

function extractJson(raw: string): unknown {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const start = text.search(/[\{\[]/);
  if (start === -1) throw new Error("No JSON found in model output");
  const openChar = text[start];
  const closeChar = openChar === "[" ? "]" : "}";
  const end = text.lastIndexOf(closeChar);
  if (end === -1 || end < start) throw new Error("Unterminated JSON in model output");
  let candidate = text.substring(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    candidate = candidate.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(candidate);
  }
}

const FINDER_SYSTEM = `You are an expert automotive researcher helping shortlist real cars for a buyer. You MUST respond with ONLY a valid JSON array (no prose, no markdown fences).

DATA INTEGRITY RULES (critical):
- Only REAL, verifiable production vehicles currently (or recently) on sale. Never invent a car, variant, price, specification or rating.
- Use the exact string "Not Available" for any string field you are unsure about; use null for any rating you are unsure about. Never guess.
- Prices must be India ex-showroom prices in INR written like "Rs 8.1 - 12.5 lakh" or "Rs 2.1 - 4.2 crore". Only include cars genuinely sold in India. If you cannot recall a credible India price, still list the car but set priceRange to "Not Available".
- Specifications must be real: include units exactly as known ("88 bhp", "115 Nm", "10.9 s", "20.5 km/l", "400 km range" for EVs).
- bodyType should be a standard description like "SUV", "Compact SUV", "Hatchback", "Sedan", "MPV", "Coupe", "Sports Car", "Pickup", "Estate".
- safety is the known crash-test result if verified (e.g. "5-star (Bharat NCAP)"), otherwise "Not Available".
- comfortRating, luxuryRating, reliabilityRating are consensus expert ratings you are confident about, integers 0-10; use null when unsure.
- highlight is one short sentence (max 18 words) on what makes this car distinctive.
- Do NOT include the same model twice; variants of one model are one entry.`;

const CANDIDATE_SCHEMA_HINT = `[{
  "name": string (full exact model name incl. brand), "brand": string, "modelYear": string,
  "bodyType": string, "country": string, "fuelType": string (e.g. "Petrol", "Diesel", "CNG", "Hybrid (HEV)", "Electric (EV)", "Petrol + CNG"),
  "priceRange": string (India ex-showroom, e.g. "Rs 8.1 - 12.5 lakh"),
  "horsepower": string, "torque": string, "zeroToHundred": string,
  "fuelEconomyOrRange": string (e.g. "20.5 km/l" or "400 km range"),
  "seatingCapacity": string, "safety": string,
  "comfortRating": number 0-10 or null, "luxuryRating": number 0-10 or null, "reliabilityRating": number 0-10 or null,
  "highlight": string
}]`;

export async function generateFinderCandidates(
  prefs: FinderPreferences,
): Promise<FinderCandidate[]> {
  const model = getModel();
  const bodyLine = prefs.bodyType ? `Body type: ONLY ${prefs.bodyType} cars.` : "Body type: any.";
  const fuelLine = prefs.fuelType
    ? `Fuel: ONLY cars with a genuine factory ${prefs.fuelType} powertrain option. If you are not certain a car offers that fuel type, do not include it.`
    : "Fuel: any.";
  const prompt = `Shortlist 10-12 real cars for this buyer:
- Budget: ₹${prefs.budgetMinLakh} - ${prefs.budgetMaxLakh} lakh (India ex-showroom). Only include cars whose India ex-showroom price falls inside this budget; if unsure of the price, you may still include the car with priceRange "Not Available" and the buyer's side will verify.
- ${bodyLine}
- ${fuelLine}
- Usage: ${prefs.usage} driving. Favour cars well suited to it.
- Variety: cover different brands and price points within the budget.

Respond with ONLY a JSON array of 10-12 objects matching this schema:
${CANDIDATE_SCHEMA_HINT}`;

  const result = await generateText({
    model,
    system: FINDER_SYSTEM,
    prompt,
  });
  const parsed = extractJson(result.text ?? "");
  const list = Array.isArray(parsed) ? parsed : [];

  const str = (v: unknown) =>
    typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : NA;
  const num = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 10
      ? Math.round(v)
      : typeof v === "string" && v.trim() && !Number.isNaN(parseFloat(v)) && parseFloat(v) >= 0 && parseFloat(v) <= 10
        ? Math.round(parseFloat(v))
        : null;

  const out: FinderCandidate[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const name = str(o.name);
    if (name === NA) continue;
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      brand: str(o.brand),
      modelYear: str(o.modelYear),
      bodyType: str(o.bodyType),
      country: str(o.country),
      fuelType: str(o.fuelType),
      priceRange: str(o.priceRange),
      horsepower: str(o.horsepower),
      torque: str(o.torque),
      zeroToHundred: str(o.zeroToHundred),
      fuelEconomyOrRange: str(o.fuelEconomyOrRange),
      seatingCapacity: str(o.seatingCapacity),
      safety: str(o.safety),
      comfortRating: num(o.comfortRating),
      luxuryRating: num(o.luxuryRating),
      reliabilityRating: num(o.reliabilityRating),
      highlight: str(o.highlight) === NA ? "" : str(o.highlight),
    });
  }
  return out;
}
