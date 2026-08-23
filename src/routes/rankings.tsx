import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Trophy, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { fetchRanking } from "@/lib/rankings.functions";
import { RANKING_CATEGORIES, RANKING_FILTERS, getCategory, getFilter } from "@/lib/rankings-data";

const searchSchema = z.object({
  category: z.string().optional(),
  filter: z.string().optional(),
});

export const Route = createFileRoute("/rankings")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Car Rankings — Fastest, Most Powerful & Best Cars | VIP DriveVerse" },
      { name: "description", content: "Dynamic AI-generated car rankings: fastest cars, best acceleration, most powerful, best SUVs, EVs, luxury, value and more." },
      { property: "og:title", content: "Car Rankings | VIP DriveVerse" },
      { property: "og:description", content: "Explore ranked lists of the fastest, most powerful and best cars in every category." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RankingsPage,
});

const GROUPS = ["Performance", "Categories", "Value & Other"] as const;

function medal(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return "";
}

function RankingsPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const categoryKey = getCategory(search.category ?? "fastest").key;
  const filterKey = getFilter(search.filter ?? "all").key;
  const category = getCategory(categoryKey);
  const filter = getFilter(filterKey);

  const { data, isLoading, error } = useQuery({
    queryKey: ["ranking", categoryKey, filterKey],
    queryFn: () => fetchRanking({ data: { category: categoryKey, filter: filterKey } }),
    staleTime: 1000 * 60 * 60,
  });

  const set = (next: { category?: string; filter?: string }) =>
    navigate({ to: "/rankings", search: { category: categoryKey, filter: filterKey, ...next }, replace: true });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs mb-4">
          <Trophy className="h-3.5 w-3.5 text-accent" /> Live rankings from the VIP DriveVerse car data
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold">Car <span className="gradient-text">Rankings</span></h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Ranked by real specifications — performance, category and value leaders.
        </p>
      </div>

      {/* Categories */}
      <div className="glass-strong rounded-2xl p-5 mb-5 space-y-4">
        {GROUPS.map((g) => (
          <div key={g}>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">{g}</div>
            <div className="flex flex-wrap gap-2">
              {RANKING_CATEGORIES.filter((c) => c.group === g).map((c) => (
                <button
                  key={c.key}
                  onClick={() => set({ category: c.key })}
                  className={`rounded-full px-3.5 py-1.5 text-sm border transition ${
                    c.key === categoryKey
                      ? "bg-gradient-to-r from-primary to-accent text-primary-foreground border-transparent"
                      : "glass border-border hover:border-primary/50"
                  }`}
                >
                  {c.emoji} {c.title}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {RANKING_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => set({ filter: f.key })}
            className={`rounded-full px-3 py-1.5 text-xs border transition ${
              f.key === filterKey ? "border-primary text-primary bg-primary/10" : "glass border-border hover:border-primary/40"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <h2 className="text-2xl font-bold mb-5">
        {category.emoji} {category.title}
        <span className="text-muted-foreground text-base font-normal"> • {filter.label}</span>
      </h2>

      {isLoading && (
        <div className="text-center py-20 glass rounded-3xl">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Building the ranking…</p>
        </div>
      )}

      {error && (
        <div className="text-center py-16 glass rounded-3xl">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
        </div>
      )}

      {data && data.cars.length === 0 && !isLoading && (
        <div className="text-center py-16 glass rounded-3xl">
          <p className="text-sm text-muted-foreground">No cars available for this ranking right now.</p>
        </div>
      )}

      <div className="space-y-3">
        {data?.cars.map((c) => (
          <Link
            key={c.id}
            to="/car/$name"
            params={{ name: encodeURIComponent(c.name) }}
            className="group block glass rounded-2xl p-5 hover:border-primary/50 transition"
          >
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-16 shrink-0 text-center">
                <div className="text-2xl leading-none">{medal(c.rank) || "🏅"}</div>
                <div className="mt-1 text-sm font-bold text-primary">#{c.rank}</div>
              </div>
              <div className="min-w-[200px] flex-1">
                <div className="text-lg font-bold leading-tight">{c.name}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {c.brand} • {c.modelYear}{c.bodyType !== "Not Available" ? ` • ${c.bodyType}` : ""}
                </div>
                {c.note && <p className="mt-2 text-xs text-muted-foreground/90">{c.note}</p>}
                <div className="mt-3 inline-flex items-center gap-1 text-xs text-accent">
                  View Car <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto">
                <Stat label="🚀 0-100" value={c.zeroToHundred} />
                <Stat label="🏁 Top Speed" value={c.topSpeed} />
                <Stat label="💪 Power" value={c.horsepower} />
                <Stat label="💰 Price" value={c.priceRange} />
              </div>
            </div>
            {c.metricValue !== "Not Available" && (
              <div className="mt-3 text-xs">
                <span className="rounded-full bg-primary/15 border border-primary/30 px-3 py-1">
                  {c.metricLabel}: <span className="font-semibold">{c.metricValue}</span>
                </span>
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-3 py-2 min-w-[110px]">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold truncate">{value === "Not Available" ? "—" : value}</div>
    </div>
  );
}
