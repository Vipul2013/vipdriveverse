import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type CarImages = {
  images: string[];
  source: "wikipedia" | "none";
  attribution?: string;
};

const UA = "CarVerse/1.0 (https://carverse.lovable.app; contact@carverse.app)";

async function wikiSearch(query: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(
    query + " car",
  )}&srlimit=1&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return null;
  const json = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
  return json.query?.search?.[0]?.title ?? null;
}

async function wikiImagesForTitle(title: string): Promise<string[]> {
  // Get lead image + gallery images
  const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages|images&titles=${encodeURIComponent(
    title,
  )}&pithumbsize=1600&imlimit=25&origin=*`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          thumbnail?: { source: string };
          images?: Array<{ title: string }>;
        }
      >;
    };
  };
  const pages = json.query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page) return [];

  const out: string[] = [];
  if (page.thumbnail?.source) out.push(page.thumbnail.source);

  const fileTitles = (page.images ?? [])
    .map((i) => i.title)
    .filter((t) => /\.(jpe?g|png|webp)$/i.test(t))
    .filter((t) => !/logo|icon|flag|map|svg|signature|coat_of_arms/i.test(t))
    .slice(0, 12);

  if (fileTitles.length) {
    const imgUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=1600&titles=${encodeURIComponent(
      fileTitles.join("|"),
    )}&origin=*`;
    const r2 = await fetch(imgUrl, { headers: { "User-Agent": UA } });
    if (r2.ok) {
      const j2 = (await r2.json()) as {
        query?: {
          pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }>;
        };
      };
      for (const p of Object.values(j2.query?.pages ?? {})) {
        const info = p.imageinfo?.[0];
        const u = info?.thumburl ?? info?.url;
        if (u) out.push(u);
      }
    }
  }
  // de-dupe
  return Array.from(new Set(out)).slice(0, 8);
}

export const fetchCarImages = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(1).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<CarImages> => {
    const query = data.query.trim();
    try {
      // Try direct title first, then search
      let images = await wikiImagesForTitle(query);
      if (images.length === 0) {
        const title = await wikiSearch(query);
        if (title) images = await wikiImagesForTitle(title);
      }
      if (images.length === 0) return { images: [], source: "none" };
      return { images, source: "wikipedia", attribution: "Images via Wikipedia / Wikimedia Commons" };
    } catch (err) {
      console.error("[fetchCarImages] failed:", (err as Error).message);
      return { images: [], source: "none" };
    }
  });
