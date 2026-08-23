import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { carId } from "./car-id";

export type RankedCar = {
  id: string;
  rank: number;
  name: string;
  brand: string;
  modelYear: string;
  bodyType: string;
  country: string;
  topSpeed: string;
  zeroToHundred: string;
  horsepower: string;
  torque: string;
  priceRange: string;
  metricLabel: string;
  metricValue: string;
  note: string;
};

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
    candidate = candidate
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/[\x00-\x1F\x7F]/g, " ");
    return JSON.parse(candidate);
  }
}

const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : NA;

export async function generateRanking(opts: {
  categoryTitle: string;
  metricLabel: string;
  criteria: string;
  filterLabel: string;
  filterCriteria: string;
  limit: number;
}): Promise<RankedCar[]> {
  const model = getModel();
  const prompt = `Rank the top ${opts.limit} real production cars for: "${opts.categoryTitle}".
Ranking criteria: ${opts.criteria}
Scope filter: ${opts.filterCriteria}

Rules:
- Only real, verifiable production vehicles. Never invent a car, a specification or a price.
- If a specification is genuinely unknown, use the exact string "Not Available".
- Order strictly by the ranking criteria, rank 1 = best.
- "metricValue" must be the value that decides the ranking (${opts.metricLabel}), with units.
- "name" must be the full, exact model name including brand.

Respond with ONLY a JSON array of ${opts.limit} objects:
[{"name":string,"brand":string,"modelYear":string,"bodyType":string,"country":string,"topSpeed":string,"zeroToHundred":string,"horsepower":string,"torque":string,"priceRange":string,"metricValue":string,"note":string}]
"note" is one short sentence (max 15 words) explaining the placement.`;

  const result = await generateText({
    model,
    system:
      "You are an automotive data analyst. Reply with ONLY a valid JSON array. Use real specifications only; never fabricate numbers.",
    prompt,
  });
  const parsed = extractJson(result.text ?? "");
  const list = Array.isArray(parsed) ? parsed : [];
  const seen = new Set<string>();
  const out: RankedCar[] = [];
  for (const raw of list) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const name = str(o.name);
    if (name === NA) continue;
    const id = carId(name);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      rank: out.length + 1,
      name,
      brand: str(o.brand),
      modelYear: str(o.modelYear),
      bodyType: str(o.bodyType),
      country: str(o.country),
      topSpeed: str(o.topSpeed),
      zeroToHundred: str(o.zeroToHundred),
      horsepower: str(o.horsepower),
      torque: str(o.torque),
      priceRange: str(o.priceRange),
      metricLabel: opts.metricLabel,
      metricValue: str(o.metricValue),
      note: str(o.note) === NA ? "" : str(o.note),
    });
    if (out.length >= opts.limit) break;
  }
  return out;
}
