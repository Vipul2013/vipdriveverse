import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const NA = "Not Available";

export type BrandProfile = {
  name: string;
  founded: string;
  founders: string;
  headquarters: string;
  country: string;
  website: string;
  parentCompany: string;
  history: string;
  timeline: { year: string; event: string }[];
  achievements: string[];
  facts: string[];
  brandType: string;
  globalPresence: string;
  reliability: string;
  performance: string;
  luxury: string;
  safety: string;
  popularity: string;
  popularModels: string[];
  categories: { category: string; models: string[] }[];
};

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  return createLovableAiGatewayProvider(key)("google/gemini-3-flash-preview");
}

function extractJson(raw: string): unknown {
  let text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const s = text.search(/[\{\[]/); if (s === -1) throw new Error("No JSON");
  const open = text[s], close = open === "[" ? "]" : "}";
  const e = text.lastIndexOf(close); if (e < s) throw new Error("Unterminated JSON");
  let c = text.substring(s, e + 1);
  try { return JSON.parse(c); } catch {
    return JSON.parse(c.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, " "));
  }
}

export const fetchBrandProfile = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ name: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data }): Promise<BrandProfile> => {
    const model = getModel();
    const brand = data.name.trim();
    const schema = `{
  "name": string, "founded": string, "founders": string, "headquarters": string,
  "country": string, "website": string, "parentCompany": string,
  "history": string (3-5 sentences),
  "timeline": [{"year": string, "event": string}] (5-8 major milestones),
  "achievements": string[] (4-6),
  "facts": string[] (4-6 interesting facts),
  "brandType": string (e.g. Luxury, Sports, Economy, Electric),
  "globalPresence": string, "reliability": string (X/10), "performance": string (X/10),
  "luxury": string (X/10), "safety": string (X/10), "popularity": string (X/10),
  "popularModels": string[] (5-8),
  "categories": [{"category": string, "models": string[]}]
    (group ALL notable current+recent car models the brand produces into categories like Hatchbacks, Sedans, SUVs, MPVs, Pickup Trucks, Electric Vehicles, Hybrid Vehicles, Sports Cars, Supercars, Hypercars, Luxury Cars, Performance Models. Only include categories where the brand has at least one model.)
}`;
    const prompt = `Provide accurate, up-to-date information about the automobile brand: "${brand}". Respond with ONLY a JSON object matching this schema:\n${schema}`;

    const { text } = await generateText({
      model,
      system: "You are an expert automotive brand historian. Respond with ONLY a valid JSON object.",
      prompt,
    });
    const o = extractJson(text) as Record<string, unknown>;
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : typeof v === "number" ? String(v) : NA);
    const arr = (v: unknown): string[] => Array.isArray(v) ? v.map(String).filter(Boolean) : [];
    return {
      name: str(o.name) === NA ? brand : str(o.name),
      founded: str(o.founded),
      founders: str(o.founders),
      headquarters: str(o.headquarters),
      country: str(o.country),
      website: str(o.website),
      parentCompany: str(o.parentCompany),
      history: str(o.history),
      timeline: Array.isArray(o.timeline) ? (o.timeline as any[]).map(t => ({ year: str(t?.year), event: str(t?.event) })).filter(t => t.year !== NA || t.event !== NA) : [],
      achievements: arr(o.achievements),
      facts: arr(o.facts),
      brandType: str(o.brandType),
      globalPresence: str(o.globalPresence),
      reliability: str(o.reliability),
      performance: str(o.performance),
      luxury: str(o.luxury),
      safety: str(o.safety),
      popularity: str(o.popularity),
      popularModels: arr(o.popularModels),
      categories: Array.isArray(o.categories) ? (o.categories as any[]).map(c => ({ category: str(c?.category), models: arr(c?.models) })).filter(c => c.category !== NA && c.models.length) : [],
    };
  });

// ==================== AI Assistant ====================

export const askAutomotiveAI = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).min(1).max(30),
    }).parse(i),
  )
  .handler(async ({ data }): Promise<{ reply: string; relatedCar?: string | null }> => {
    const model = getModel();
    const system = `You are VipDriveVerse AI, an expert automotive assistant. You ONLY answer questions related to automobiles: car brands, models, specifications, performance, engines, horsepower, torque, fuel economy, safety, features, reliability, maintenance, buying advice, EVs, hybrids, comparisons, launches, automotive history, motorsport, Formula 1, and future automotive tech.

If the user's question is NOT related to automobiles, reply with EXACTLY:
"I'm VipDriveVerse AI, and I specialize only in automobiles. Please ask me anything related to cars, brands, specifications, comparisons, buying advice, technologies, or the automotive industry."

Format responses in clean markdown: use bullet points, bold, and tables for comparisons. Be beginner-friendly and accurate.

If your answer prominently features ONE specific production car model, append at the very end on its own line:
[[CAR:Brand Model Name]]
Only include this tag when a single car is the clear focus. Do not include it for general topics or comparisons of multiple cars.`;

    const convo = data.messages.map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n\n");
    const { text } = await generateText({
      model,
      system,
      prompt: convo,
    });
    let reply = (text ?? "").trim();
    let relatedCar: string | null = null;
    const m = reply.match(/\[\[CAR:([^\]]+)\]\]/);
    if (m) {
      relatedCar = m[1].trim();
      reply = reply.replace(m[0], "").trim();
    }
    return { reply, relatedCar };
  });
