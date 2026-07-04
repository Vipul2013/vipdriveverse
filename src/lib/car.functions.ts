import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const NA = "Not Available";

const CarSpecSchema = z.object({
  found: z.boolean(),
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
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  return gateway("google/gemini-3-flash-preview");
}

const SPEC_SYSTEM = `You are an expert automotive researcher. Return accurate factual specifications for real-world production cars. If you are uncertain about a specific value, return exactly "Not Available" for that field rather than guessing. If the queried vehicle does not exist or you cannot reliably identify it, set found=false and leave other fields as "Not Available". Include units (e.g. "197 hp", "250 Nm", "180 km/h", "4795 mm", "60 L", "17 km/l"). Keep summary/pros/cons/advice concise and beginner-friendly.`;

export const fetchCarSpecs = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }): Promise<CarSpec> => {
    const model = getModel();
    const prompt = `Provide full specifications and analysis for the car: "${data.query}". Use the most common/latest production variant unless a specific year/variant is stated. Return every field. Use "Not Available" for unknown fields. Provide 3-5 pros, 3-5 cons, and 3-5 main competitors.`;

    try {
      const { output } = await generateText({
        model,
        system: SPEC_SYSTEM,
        prompt,
        output: Output.object({ schema: CarSpecSchema }),
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        try {
          const raw = error.text ?? "";
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return CarSpecSchema.parse(parsed);
          }
        } catch {}
      }
      // Fallback: not found
      return {
        found: false,
        name: data.query,
        brand: NA, modelYear: NA, bodyType: NA, country: NA,
        engine: NA, engineCapacity: NA, horsepower: NA, torque: NA,
        topSpeed: NA, zeroToHundred: NA, transmission: NA, drivetrain: NA,
        fuelType: NA, length: NA, width: NA, height: NA, wheelbase: NA,
        groundClearance: NA, kerbWeight: NA, seatingCapacity: NA, bootSpace: NA,
        fuelTankOrBattery: NA, wheelSize: NA, fuelEconomyOrRange: NA,
        safety: NA, priceRange: NA,
        summary: "We could not reliably identify this vehicle. Please check the spelling or try a different model.",
        bestUseCase: NA, pros: [], cons: [], targetBuyers: NA,
        competitors: [], buyingAdvice: NA,
      };
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
For each category below, name which car (from the list) is best AND briefly explain WHY (1-2 sentences). Be balanced — different cars should win different categories based on their real strengths. Never say "all are equal".
Return the answer as JSON with these keys: overallBest, bestForFamilies, bestForCity, bestForHighway, bestForOffroad, bestForPerformance, bestForMileage, bestForBudget, bestForLuxury, bestForLongTerm, finalVerdict (a 2-3 sentence summary matching each car to a buyer profile).`;

    try {
      const { output } = await generateText({
        model,
        system: "You are a balanced automotive comparison expert. Match each car to the buyer profile it serves best rather than declaring one universal winner.",
        prompt,
        output: Output.object({ schema: CompareSchema }),
      });
      return output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        const raw = error.text ?? "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            return CompareSchema.parse(JSON.parse(jsonMatch[0]));
          } catch {}
        }
      }
      const fallback = "Unable to determine";
      return {
        overallBest: fallback, bestForFamilies: fallback, bestForCity: fallback,
        bestForHighway: fallback, bestForOffroad: fallback, bestForPerformance: fallback,
        bestForMileage: fallback, bestForBudget: fallback, bestForLuxury: fallback,
        bestForLongTerm: fallback,
        finalVerdict: "The AI analysis is temporarily unavailable. Please try again.",
      };
    }
  });
