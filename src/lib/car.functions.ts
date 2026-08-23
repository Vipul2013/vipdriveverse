import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { carId, identityMatches } from "./car-id";

const NA = "Not Available";

const CarSpecSchema = z.object({
  found: z.boolean(),
  /** stable unique id derived from the canonical name */
  id: z.string(),
  /** exactly what the user searched for */
  requestedQuery: z.string(),
  /** true only when the returned car is the exact car requested */
  exactMatch: z.boolean(),
  /** when the model tried to substitute a different car, its name is kept here */
  substituteName: z.string().nullable(),
  name: z.string(),
  brand: z.string(),
  modelYear: z.string(),
  bodyType: z.string(),
  country: z.string(),
  engine: z.string(),
  engineCapacity: z.string(),
  horsepower: z.string(),
  torque: z.string(),
  topSpeed: z.string(),
  zeroToHundred: z.string(),
  transmission: z.string(),
  drivetrain: z.string(),
  fuelType: z.string(),
  length: z.string(),
  width: z.string(),
  height: z.string(),
  wheelbase: z.string(),
  groundClearance: z.string(),
  kerbWeight: z.string(),
  seatingCapacity: z.string(),
  bootSpace: z.string(),
  fuelTankOrBattery: z.string(),
  wheelSize: z.string(),
  fuelEconomyOrRange: z.string(),
  safety: z.string(),
  priceRange: z.string(),
  summary: z.string(),
  bestUseCase: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  targetBuyers: z.string(),
  competitors: z.array(z.string()),
  buyingAdvice: z.string(),
});

export type CarSpec = z.infer<typeof CarSpecSchema>;

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY — enable Lovable Cloud / AI to provision it.");
  const gateway = createLovableAiGatewayProvider(key);
  return gateway("google/gemini-3-flash-preview");
}

function extractJson(raw: string): unknown {
  let text = raw.trim();
  // strip markdown fences
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
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

function coerceToSpec(query: string, obj: unknown): CarSpec {
  const o = (obj ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : NA);
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : String(x))).filter(Boolean) : [];
  const rawName = str(o.name) === NA ? query : str(o.name);
  const recognized = o.found === false ? false : true;
  const exact = recognized && identityMatches(query, rawName);
  const name = exact ? rawName : query;
  return {
    found: recognized && exact,
    id: carId(name),
    requestedQuery: query,
    exactMatch: exact,
    substituteName: recognized && !exact ? rawName : null,
    name,
    brand: str(o.brand),
    modelYear: str(o.modelYear),
    bodyType: str(o.bodyType),
    country: str(o.country),
    engine: str(o.engine),
    engineCapacity: str(o.engineCapacity),
    horsepower: str(o.horsepower),
    torque: str(o.torque),
    topSpeed: str(o.topSpeed),
    zeroToHundred: str(o.zeroToHundred),
    transmission: str(o.transmission),
    drivetrain: str(o.drivetrain),
    fuelType: str(o.fuelType),
    length: str(o.length),
    width: str(o.width),
    height: str(o.height),
    wheelbase: str(o.wheelbase),
    groundClearance: str(o.groundClearance),
    kerbWeight: str(o.kerbWeight),
    seatingCapacity: str(o.seatingCapacity),
    bootSpace: str(o.bootSpace),
    fuelTankOrBattery: str(o.fuelTankOrBattery),
    wheelSize: str(o.wheelSize),
    fuelEconomyOrRange: str(o.fuelEconomyOrRange),
    safety: str(o.safety),
    priceRange: str(o.priceRange),
    summary: str(o.summary),
    bestUseCase: str(o.bestUseCase),
    pros: arr(o.pros),
    cons: arr(o.cons),
    targetBuyers: str(o.targetBuyers),
    competitors: arr(o.competitors),
    buyingAdvice: str(o.buyingAdvice),
  };
}

const SPEC_SYSTEM = `You are an expert automotive researcher. You MUST respond with ONLY a valid JSON object (no prose, no markdown fences) matching the schema requested. Use "Not Available" for any field you are unsure about. Include units in values (e.g. "197 hp", "250 Nm", "180 km/h", "4795 mm", "60 L", "17 km/l").

IDENTITY RULES (critical):
- Return data for the EXACT model requested, including its exact model code/number.
- NEVER substitute a similar or nearby model (e.g. do NOT answer "XUV 3XO" when "XUV 7XO" was asked).
- If the exact model does not exist or you do not recognise it, set "found": false and leave every other field as "Not Available". Do not guess.
- The "name" field must contain the exact requested model name (brand + model), never a different model.`;

const SPEC_SCHEMA_HINT = `{
  "found": boolean (true if you recognize the vehicle),
  "name": string, "brand": string, "modelYear": string, "bodyType": string, "country": string,
  "engine": string, "engineCapacity": string, "horsepower": string, "torque": string,
  "topSpeed": string, "zeroToHundred": string, "transmission": string, "drivetrain": string,
  "fuelType": string, "length": string, "width": string, "height": string, "wheelbase": string,
  "groundClearance": string, "kerbWeight": string, "seatingCapacity": string, "bootSpace": string,
  "fuelTankOrBattery": string, "wheelSize": string, "fuelEconomyOrRange": string,
  "safety": string, "priceRange": string, "summary": string, "bestUseCase": string,
  "pros": string[], "cons": string[], "targetBuyers": string,
  "competitors": string[], "buyingAdvice": string
}`;

export const fetchCarSpecs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }): Promise<CarSpec> => {
    const query = data.query.trim();
    const model = getModel();
    const prompt = `Return full JSON specifications for this EXACT car: "${query}". Use the latest common production variant unless a year/variant is specified. If "${query}" is not a real vehicle you recognise, respond with {"found": false, "name": "${query}"} only — never return a different model instead. Provide 3-5 pros, 3-5 cons, and 3-5 competitor names. Respond with ONLY a JSON object matching this schema:\n${SPEC_SCHEMA_HINT}`;

    let rawText = "";
    try {
      const result = await generateText({ model, system: SPEC_SYSTEM, prompt });
      rawText = result.text ?? "";
      console.log("[fetchCarSpecs] query:", query, "raw length:", rawText.length);
      if (!rawText) throw new Error("Empty response from model");
      const parsed = extractJson(rawText);
      const spec = coerceToSpec(query, parsed);
      return spec;
    } catch (err) {
      console.error("[fetchCarSpecs] failed for", query, "error:", (err as Error).message, "raw:", rawText.slice(0, 500));
      throw new Error(
        `AI search failed for "${query}": ${(err as Error).message}${rawText ? ` — model output starts with: ${rawText.slice(0, 200)}` : ""}`,
      );
    }
  });

const CompareSchema = z.object({
  overallBest: z.string(),
  bestForFamilies: z.string(),
  bestForCity: z.string(),
  bestForHighway: z.string(),
  bestForOffroad: z.string(),
  bestForPerformance: z.string(),
  bestForMileage: z.string(),
  bestForBudget: z.string(),
  bestForLuxury: z.string(),
  bestForLongTerm: z.string(),
  finalVerdict: z.string(),
});

export type Comparison = z.infer<typeof CompareSchema>;

export const compareCarsAI = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ cars: z.array(z.string().min(1)).min(2).max(3) }).parse(input),
  )
  .handler(async ({ data }): Promise<Comparison> => {
    const model = getModel();
    const prompt = `Compare these cars: ${data.cars.join(" vs ")}.
For each category, name which car (from the list) is best AND briefly explain WHY (1-2 sentences). Be balanced — different cars should win different categories.
Respond with ONLY a JSON object (no markdown) with these string keys: overallBest, bestForFamilies, bestForCity, bestForHighway, bestForOffroad, bestForPerformance, bestForMileage, bestForBudget, bestForLuxury, bestForLongTerm, finalVerdict.`;

    let rawText = "";
    try {
      const result = await generateText({
        model,
        system: "You are a balanced automotive comparison expert. Reply with ONLY a valid JSON object.",
        prompt,
      });
      rawText = result.text ?? "";
      const parsed = extractJson(rawText) as Record<string, unknown>;
      const str = (v: unknown, fb = "Unable to determine") =>
        typeof v === "string" && v.trim() ? v : fb;
      return {
        overallBest: str(parsed.overallBest),
        bestForFamilies: str(parsed.bestForFamilies),
        bestForCity: str(parsed.bestForCity),
        bestForHighway: str(parsed.bestForHighway),
        bestForOffroad: str(parsed.bestForOffroad),
        bestForPerformance: str(parsed.bestForPerformance),
        bestForMileage: str(parsed.bestForMileage),
        bestForBudget: str(parsed.bestForBudget),
        bestForLuxury: str(parsed.bestForLuxury),
        bestForLongTerm: str(parsed.bestForLongTerm),
        finalVerdict: str(parsed.finalVerdict, "The AI analysis is temporarily unavailable. Please try again."),
      };
    } catch (err) {
      console.error("[compareCarsAI] failed:", (err as Error).message, "raw:", rawText.slice(0, 500));
      throw new Error(`AI comparison failed: ${(err as Error).message}`);
    }
  });
