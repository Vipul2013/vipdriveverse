import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { getModel } from "./car.functions";
import { identityMatches } from "./car-id";

const NA = "Not Available";

const EngineOptionSchema = z.object({
  variantName: z.string(),
  fuelType: z.string(),
  engine: z.string(),
  engineCapacity: z.string(),
  cylinders: z.string(),
  power: z.string(),
  torque: z.string(),
  transmission: z.string(),
  drivetrain: z.string(),
  mileageOrRange: z.string(),
  price: z.string(),
  fittedType: z.enum(["factory", "aftermarket"]),
  notes: z.string().nullable(),
});

export type EngineOption = z.infer<typeof EngineOptionSchema>;

const EngineOptionsResponseSchema = z.object({
  found: z.boolean(),
  options: z.array(EngineOptionSchema),
});

function extractJson(raw: string): unknown {
  let text = raw.trim();
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

const ENGINE_SYSTEM = `You are an expert automotive researcher specializing in powertrains, variants and fuel options. You MUST respond with ONLY a valid JSON object (no prose, no markdown fences). Use "Not Available" for any single field you are unsure about. Include units in values (e.g. "1197 cc", "4 cylinders", "82 bhp", "115 Nm", "5-speed manual", "20.5 km/l", "Rs 7.5 - 8.9 lakh").

IDENTITY AND EVIDENCE RULES (critical):
- List ONLY the genuine factory-available engine and fuel options of the EXACT car requested (brand + model + exact model code), for the requested market and model year.
- NEVER invent or assume an option. Never list diesel for a petrol-only car, CNG unless a factory/official CNG variant exists, hybrid unless a factory hybrid exists, EV unless the car is electric, etc. If you are not certain an option exists, omit it.
- Include every genuine factory variant: different engine capacities, turbo vs naturally aspirated, bi-fuel (Petrol + CNG), mild hybrid, HEV, PHEV, EV battery/motor options, hydrogen fuel cell where they genuinely exist.
- You may additionally include a well-known, officially supported aftermarket conversion (e.g. an endorsed CNG retrofit kit) with "fittedType": "aftermarket" and a short note. Everything else must be "factory".
- Never mix models, variants or generations: options must belong to the exact requested car and generation.
- If the car is not recognised, or you cannot verify ANY option with confidence, respond {"found": false, "options": []}. Never guess.`;

const SCHEMA_HINT = `{
  "found": boolean (true only if you recognise the car AND verified at least one genuine option),
  "options": [ {
    "variantName": string (the real variant/trim name, e.g. "SX(O) 1.2 CNG"),
    "fuelType": string ("Petrol", "Diesel", "CNG", "Petrol + CNG", "Hybrid (HEV)", "Plug-in Hybrid (PHEV)", "Mild Hybrid", "Electric (EV)", "Hydrogen Fuel Cell"),
    "engine": string, "engineCapacity": string, "cylinders": string,
    "power": string, "torque": string, "transmission": string, "drivetrain": string,
    "mileageOrRange": string (mileage km/l, km/kg or EV range km),
    "price": string, "fittedType": "factory" | "aftermarket",
    "notes": string or null
  } ]
}`;

export const fetchEngineOptions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        carId: z.string().min(1).max(200),
        carName: z.string().min(1).max(200),
        brand: z.string().optional(),
        modelYear: z.string().optional(),
        country: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const market = "India";
    const year = (data.modelYear && data.modelYear !== NA ? data.modelYear : "").trim();
    const country = (data.country && data.country !== NA ? data.country : "").trim();
    const brand = (data.brand && data.brand !== NA ? data.brand : "").trim();
    const query = [brand, data.carName].filter(Boolean).join(" ");

    // 1) Serve verified/cached rows first.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: cached, error } = await supabaseAdmin
        .from("car_engine_options")
        .select("*")
        .eq("car_id", data.carId)
        .eq("market", market);
      if (!error && cached && cached.length > 0) {
        return {
          found: true,
          options: cached.map(
            (r): EngineOption => ({
              variantName: r.variant_name,
              fuelType: r.fuel_type,
              engine: r.engine ?? NA,
              engineCapacity: r.engine_capacity ?? NA,
              cylinders: r.cylinders ?? NA,
              power: r.power ?? NA,
              torque: r.torque ?? NA,
              transmission: r.transmission ?? NA,
              drivetrain: r.drivetrain ?? NA,
              mileageOrRange: r.mileage_or_range ?? NA,
              price: r.price ?? NA,
              fittedType: r.fitted_type === "aftermarket" ? "aftermarket" : "factory",
              notes: r.notes ?? null,
            }),
          ),
        };
      }
    } catch (err) {
      console.error("[fetchEngineOptions] cache read failed:", (err as Error).message);
    }

    // 2) Generate verified options with AI.
    const model = getModel();
    const prompt = `Car: "${query}"${year ? `, model year ${year}` : ""}${country ? `, sold in ${country}` : ""}.
Market to answer for: ${market}. List ONLY its genuine, factory-available engine and fuel options for this market${year ? ` and this model year` : ""}. If several generations were sold, use the latest common production generation${year ? ` matching ${year}` : ""}.
Respond with ONLY a JSON object matching this schema:\n${SCHEMA_HINT}`;

    let rawText = "";
    try {
      const result = await generateText({ model, system: ENGINE_SYSTEM, prompt });
      rawText = result.text ?? "";
      if (!rawText) throw new Error("Empty response from model");
      const parsed = extractJson(rawText) as Record<string, unknown>;

      const recognized = parsed.found === false ? false : true;
      const rawOptions = Array.isArray(parsed.options) ? parsed.options : [];

      // Strict coercion: drop anything without a real variant name + fuel type.
      const seen = new Set<string>();
      const options: EngineOption[] = [];
      for (const o of rawOptions as Record<string, unknown>[]) {
        const str = (v: unknown) =>
          typeof v === "string" && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : NA;
        const variantName = str(o.variantName);
        const fuelType = str(o.fuelType);
        if (variantName === NA || fuelType === NA) continue;
        const key = [variantName.toLowerCase(), fuelType.toLowerCase(), str(o.engine).toLowerCase()].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const fitted = o.fittedType === "aftermarket" ? "aftermarket" : "factory";
        options.push({
          variantName,
          fuelType,
          engine: str(o.engine),
          engineCapacity: str(o.engineCapacity),
          cylinders: str(o.cylinders),
          power: str(o.power),
          torque: str(o.torque),
          transmission: str(o.transmission),
          drivetrain: str(o.drivetrain),
          mileageOrRange: str(o.mileageOrRange),
          price: str(o.price),
          fittedType: fitted,
          notes: typeof o.notes === "string" && o.notes.trim() ? o.notes.trim() : null,
        });
      }

      const found = recognized && options.length > 0 && identityMatches(data.carName, query);
      if (!found) return { found: false, options: [] as EngineOption[] };

      // 3) Cache the verified options for next time (best effort).
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("car_engine_options").insert(
          options.map((o) => ({
            car_id: data.carId,
            car_name: data.carName,
            brand: brand || null,
            model_year: year || null,
            market,
            variant_name: o.variantName,
            fuel_type: o.fuelType,
            engine: o.engine === NA ? null : o.engine,
            engine_capacity: o.engineCapacity === NA ? null : o.engineCapacity,
            cylinders: o.cylinders === NA ? null : o.cylinders,
            power: o.power === NA ? null : o.power,
            torque: o.torque === NA ? null : o.torque,
            transmission: o.transmission === NA ? null : o.transmission,
            drivetrain: o.drivetrain === NA ? null : o.drivetrain,
            mileage_or_range: o.mileageOrRange === NA ? null : o.mileageOrRange,
            price: o.price === NA ? null : o.price,
            fitted_type: o.fittedType,
            notes: o.notes,
          })),
        );
      } catch (err) {
        console.error("[fetchEngineOptions] cache write failed:", (err as Error).message);
      }

      return { found: true, options };
    } catch (err) {
      console.error(
        "[fetchEngineOptions] failed for",
        query,
        "error:",
        (err as Error).message,
        "raw:",
        rawText.slice(0, 500),
      );
      throw new Error(`Engine options lookup failed for "${query}": ${(err as Error).message}`);
    }
  });
