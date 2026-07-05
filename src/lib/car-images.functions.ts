import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CarImages = {
  images: string[];
  source: "wikipedia" | "none";
  attribution?: string;
  matchedTitle?: string;
};

const UA = "CarVerse/1.0 (https://carverse.lovable.app; contact@carverse.app)";

// --- Normalization & token helpers ---------------------------------------

const BRAND_ALIASES: Record<string, string[]> = {
  "maruti": ["maruti", "suzuki", "maruti suzuki"],
  "maruti suzuki": ["maruti", "suzuki", "maruti suzuki"],
  "suzuki": ["suzuki", "maruti"],
  "mercedes": ["mercedes", "mercedes-benz", "benz"],
  "mercedes-benz": ["mercedes", "mercedes-benz", "benz"],
  "vw": ["vw", "volkswagen"],
  "volkswagen": ["volkswagen", "vw"],
  "chevy": ["chevy", "chevrolet"],
  "chevrolet": ["chevrolet", "chevy"],
};

const STOPWORDS = new Set([
  "car", "cars", "the", "new", "sedan", "suv", "hatchback", "coupe",
  "convertible", "pickup", "mpv", "review", "spec", "specs",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\.(jpe?g|png|webp|svg|gif)$/i, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t && !STOPWORDS.has(t));
}

/**
 * Split query into (brand tokens, model tokens). Assumes brand = first 1–2 words.
 */
function splitBrandModel(query: string): { brand: string[]; model: string[]; all: string[] } {
  const all = tokens(query);
  if (all.length === 0) return { brand: [], model: [], all };
  // Two-word brand check
  const two = `${all[0]} ${all[1] ?? ""}`.trim();
  if (BRAND_ALIASES[two]) {
    return { brand: BRAND_ALIASES[two], model: all.slice(2), all };
  }
  const one = all[0];
  const brand = BRAND_ALIASES[one] ?? [one];
  return { brand, model: all.slice(1), all };
}

/**
 * A title matches iff EVERY model token appears in the title,
 * AND at least one brand alias appears in the title (when brand known).
 * Reject titles that contain other well-known conflicting model names — handled
 * implicitly: if all model tokens must appear, "Swift" won't match "WagonR".
 */
function titleMatches(candidate: string, query: string): boolean {
  const t = normalize(candidate);
  const { brand, model } = splitBrandModel(query);
  if (model.length === 0) {
    // brand-only query: brand must appear
    return brand.some((b) => t.includes(b));
  }
  const modelOk = model.every((m) => {
    // Also allow concatenated variant (e.g. "wagon r" vs "wagonr")
    return t.includes(m) || t.replace(/\s+/g, "").includes(m);
  });
  const brandOk = brand.length === 0 || brand.some((b) => t.includes(b));
  return modelOk && brandOk;
}

// --- Wikipedia calls ------------------------------------------------------

async function wikiSearchTitles(query: string, limit = 5): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srlimit=${limit}&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
  return (json.query?.search ?? []).map((s) => s.title);
}

async function wikiPageImages(title: string, originalQuery: string): Promise<string[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|images&titles=${encodeURIComponent(
    title,
  )}&pithumbsize=1600&imlimit=40&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        { thumbnail?: { source: string }; images?: Array<{ title: string }> }
      >;
    };
  };
  const page = Object.values(json.query?.pages ?? {})[0];
  if (!page) return [];

  const out: string[] = [];
  // Lead thumbnail is chosen by Wikipedia for the article; if the article title
  // matches, the lead image is trustworthy.
  if (page.thumbnail?.source) out.push(page.thumbnail.source);

  // Only accept gallery files whose FILENAME contains all model tokens
  // (this filters out incidental images of other cars in the article).
  const fileTitles = (page.images ?? [])
    .map((i) => i.title)
    .filter((t) => /\.(jpe?g|png|webp)$/i.test(t))
    .filter((t) => !/logo|icon|flag|map|svg|signature|coat_of_arms|badge|emblem/i.test(t))
    .filter((t) => titleMatches(t.replace(/^File:/i, ""), originalQuery))
    .slice(0, 12);

  if (fileTitles.length) {
    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=1600&titles=${encodeURIComponent(
      fileTitles.join("|"),
    )}&origin=*`;
    const r2 = await fetch(imgUrl, { headers: { "User-Agent": UA } });
    if (r2.ok) {
      const j2 = (await r2.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              imageinfo?: Array<{
                thumburl?: string;
                url?: string;
                extmetadata?: { ObjectName?: { value?: string }; ImageDescription?: { value?: string } };
              }>;
            }
          >;
        };
      };
      for (const p of Object.values(j2.query?.pages ?? {})) {
        const info = p.imageinfo?.[0];
        const u = info?.thumburl ?? info?.url;
        if (!u) continue;
        // Double-check with the filename & metadata description
        const meta = [
          p.title ?? "",
          info?.extmetadata?.ObjectName?.value ?? "",
          info?.extmetadata?.ImageDescription?.value ?? "",
        ].join(" ");
        if (titleMatches(meta, originalQuery)) out.push(u);
      }
    }
  }
  return Array.from(new Set(out)).slice(0, 8);
}

// --- Public server function -----------------------------------------------

export const fetchCarImages = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<CarImages> => {
    const query = data.query.trim();
    try {
      // Search several candidate articles, then keep only titles that pass
      // the strict brand+model check. This avoids Wikipedia's fuzzy search
      // returning a sibling model (e.g. "Swift" when we asked for "WagonR").
      const candidates = await wikiSearchTitles(`${query} car`, 5);
      const matches = candidates.filter((t) => titleMatches(t, query));

      // Also try the raw query as a direct title, if it matches.
      if (titleMatches(query, query)) matches.unshift(query);

      const uniqueTitles = Array.from(new Set(matches));
      for (const title of uniqueTitles) {
        const images = await wikiPageImages(title, query);
        if (images.length > 0) {
          return {
            images,
            source: "wikipedia",
            attribution: "Images via Wikipedia / Wikimedia Commons",
            matchedTitle: title,
          };
        }
      }
      console.log(`[fetchCarImages] no strict match for "${query}" (candidates: ${candidates.join(" | ")})`);
      return { images: [], source: "none" };
    } catch (err) {
      console.error("[fetchCarImages] failed:", (err as Error).message);
      return { images: [], source: "none" };
    }
  });
