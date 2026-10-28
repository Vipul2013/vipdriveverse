import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Compass,
  Loader2,
  AlertCircle,
  Info,
  ArrowRight,
  Eye,
  GitCompare,
  Sparkles,
  IndianRupee,
} from "lucide-react";
import { findCars, type FinderResult } from "@/lib/finder.functions";
import {
  BODY_TYPES,
  FUEL_TYPES,
  PRIORITIES,
  USAGES,
  FinderPreferencesSchema,
  type FinderPreferences,
} from "@/lib/finder-data";
import { fetchCarImages } from "@/lib/car-images.functions";

export const Route = createFileRoute("/finder")({
  head: () => ({
    meta: [
      { title: "Smart Car Finder — Find Your Perfect Car | VIP DriveVerse" },
      {
        name: "description",
        content:
          "Enter your budget and preferences — body type, fuel, priorities and usage — and get transparently ranked car recommendations with verified prices, specs and reasons.",
      },
      { property: "og:title", content: "Smart Car Finder — Find Your Perfect Car | VIP DriveVerse" },
      {
        property: "og:description",
        content:
          "Tell us your budget and preferences and get transparently ranked car recommendations with verified prices, specifications and clear match reasons.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinderPage,
});

const DEFAULT_PREFS: FinderPreferences = {
  budgetMinLakh: 5,
  budgetMaxLakh: 20,
  bodyType: "suv",
  fuelType: "",
  priorities: ["value", "efficiency", "safety"],
  usage: "mixed",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-primary/25 border border-primary/60 px-3.5 py-1.5 text-sm text-primary font-medium transition"
          : "rounded-full glass px-3.5 py-1.5 text-sm hover:border-primary/50 transition"
      }
    >
      {children}
    </button>
  );
}

function FinderPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<FinderPreferences>(DEFAULT_PREFS);
  const [committed, setCommitted] = useState<FinderPreferences | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const results = useQuery({
    queryKey: ["finder", committed ? JSON.stringify(committed) : "none"],
    queryFn: () => findCars({ data: committed! }),
    enabled: !!committed,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const images = useQueries({
    queries: (results.data?.matches ?? []).slice(0, 12).map((m) => ({
      queryKey: ["car-images", m.id],
      queryFn: () => fetchCarImages({ data: { query: m.name } }),
      staleTime: 1000 * 60 * 60 * 24,
    })),
  });

  const setPrefs = (patch: Partial<FinderPreferences>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const togglePriority = (key: (typeof PRIORITIES)[number]["key"]) => {
    setDraft((d) => {
      const has = d.priorities.includes(key);
      const next = has ? d.priorities.filter((p) => p !== key) : [...d.priorities, key];
      return next.length ? { ...d, priorities: next } : d;
    });
  };

  const run = () => {
    const parsed = FinderPreferencesSchema.safeParse(draft);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Please check your preferences.");
      return;
    }
    setFormError(null);
    setSelected(new Set());
    setCommitted(parsed.data);
  };

  const toggleCompare = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });

  const compareSelected = () => {
    if (selected.size < 2) return;
    navigate({ to: "/compare", search: { cars: [...selected].join(",") } });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs mb-4">
          <Compass className="h-3.5 w-3.5 text-accent" /> Smart Car Finder
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold">
          Find Your <span className="gradient-text">Perfect Car</span>
        </h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          Set your budget and preferences — we shortlist real cars, verify their prices and
          specifications, and rank them transparently against what you care about.
        </p>
      </div>

      {/* Preferences */}
      <div className="glass-strong rounded-3xl p-6 sm:p-8 max-w-4xl mx-auto mb-10">
        {/* Budget */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            Budget (₹ lakh, ex-showroom)
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-border px-3 py-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                min={0}
                value={draft.budgetMinLakh}
                onChange={(e) => setPrefs({ budgetMinLakh: Number(e.target.value) })}
                className="w-20 bg-transparent outline-none text-sm"
                aria-label="Budget minimum in lakh"
              />
              <span className="text-xs text-muted-foreground">from</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-border px-3 py-2">
              <IndianRupee className="h-4 w-4 text-muted-foreground" />
              <input
                type="number"
                min={0}
                value={draft.budgetMaxLakh}
                onChange={(e) => setPrefs({ budgetMaxLakh: Number(e.target.value) })}
                className="w-20 bg-transparent outline-none text-sm"
                aria-label="Budget maximum in lakh"
              />
              <span className="text-xs text-muted-foreground">to</span>
            </div>
          </div>
        </div>

        {/* Body type */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            Body type
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={draft.bodyType === ""} onClick={() => setPrefs({ bodyType: "" })}>
              Any
            </Chip>
            {BODY_TYPES.map((b) => (
              <Chip
                key={b.key}
                active={draft.bodyType === b.key}
                onClick={() => setPrefs({ bodyType: b.key })}
              >
                {b.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Fuel type */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            Fuel type
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip active={draft.fuelType === ""} onClick={() => setPrefs({ fuelType: "" })}>
              Any
            </Chip>
            {FUEL_TYPES.map((f) => (
              <Chip
                key={f.key}
                active={draft.fuelType === f.key}
                onClick={() => setPrefs({ fuelType: f.key })}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Priorities */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            What matters most to you? <span className="text-muted-foreground normal-case">(pick any — each adds equal weight)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRIORITIES.map((p) => (
              <Chip
                key={p.key}
                active={draft.priorities.includes(p.key)}
                onClick={() => togglePriority(p.key)}
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Usage */}
        <div className="mb-6">
          <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-3">
            Primary usage <span className="text-muted-foreground normal-case">(nudges related priorities)</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {USAGES.map((u) => (
              <Chip
                key={u.key}
                active={draft.usage === u.key}
                onClick={() => setPrefs({ usage: u.key })}
              >
                {u.label}
              </Chip>
            ))}
          </div>
        </div>

        {formError && (
          <p className="mb-4 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {formError}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={run}
            disabled={results.isFetching}
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition inline-flex items-center gap-2 disabled:opacity-60"
          >
            {results.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {committed ? "Update Recommendations" : "Find My Cars"}
          </button>
          <p className="text-xs text-muted-foreground max-w-md flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            Transparent scoring: cars are ranked only on verified prices and specifications.
            Cars with unverifiable prices, or missing data for a priority you picked, are
            excluded and listed below.
          </p>
        </div>
      </div>

      {/* Results */}
      {!committed && (
        <div className="text-center py-16 glass rounded-3xl max-w-3xl mx-auto">
          <Compass className="h-10 w-10 mx-auto text-accent mb-3" />
          <p className="text-lg font-semibold">Set your budget above and hit "Find My Cars"</p>
          <p className="mt-2 text-sm text-muted-foreground">
            You'll get ranked recommendations with photos, verified prices, key specs and a
            clear reason for every match.
          </p>
        </div>
      )}

      {committed && results.isPending && (
        <div className="text-center py-16 glass rounded-3xl max-w-3xl mx-auto">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">
            Shortlisting real cars within your budget and scoring them against your
            priorities...
          </p>
        </div>
      )}

      {committed && results.isError && (
        <div className="glass rounded-2xl p-5 max-w-3xl mx-auto flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Couldn't load recommendations</p>
            <p className="text-muted-foreground">{(results.error as Error).message}</p>
          </div>
        </div>
      )}

      {committed && results.data && <FinderResults result={results.data} images={images.map((q) => q.data)} selected={selected} onToggleCompare={toggleCompare} />}

      {/* Floating compare bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
          <div className="glass-strong rounded-full pl-4 pr-2 py-2 flex items-center gap-3 pointer-events-auto shadow-xl">
            <span className="text-sm font-medium">
              {selected.size} car{selected.size > 1 ? "s" : ""} selected
            </span>
            <button
              onClick={compareSelected}
              disabled={selected.size < 2}
              className="rounded-full bg-gradient-to-r from-primary to-accent px-4 py-2 text-xs font-semibold text-primary-foreground inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <GitCompare className="h-3.5 w-3.5" /> Compare now
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-full glass px-3 py-2 text-xs"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FinderResults({
  result,
  images,
  selected,
  onToggleCompare,
}: {
  result: FinderResult;
  images: ({ images: string[]; source: string } | undefined)[];
  selected: Set<string>;
  onToggleCompare: (id: string) => void;
}) {
  const { matches, excluded, checkedCount } = result;

  if (matches.length === 0) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="glass rounded-3xl p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-accent mb-3" />
          <p className="text-lg font-semibold">No cars matched your filters</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We checked {checkedCount} real candidate cars. Try widening the budget, picking a
            different body type or fuel, or removing a priority whose data is scarce.
          </p>
        </div>
        {excluded.length > 0 && <ExcludedPanel excluded={excluded} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
        <h2 className="text-2xl font-bold">
          {matches.length} Recommendation{matches.length > 1 ? "s" : ""}
        </h2>
        <span className="text-xs text-muted-foreground">
          Ranked by your priorities • select 2–3 to compare
        </span>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {matches.map((m, i) => {
          const img = images[i]?.images?.[0];
          return (
            <div key={m.id} className="glass rounded-2xl p-5 flex flex-col hover:border-primary/40 transition">
              <div className="flex items-start justify-between mb-3">
                <span className="rounded-full bg-primary/20 border border-primary/40 text-primary text-xs font-bold px-2.5 py-1">
                  #{m.rank}
                </span>
                <div className="text-right">
                  <div className="text-2xl font-bold gradient-text leading-none">{m.matchScore}%</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">match</div>
                </div>
              </div>

              <div className="h-36 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 mb-3 flex items-center justify-center overflow-hidden">
                {img ? (
                  <img src={img} alt={m.name} className="h-full w-full object-cover rounded-xl" loading="lazy" />
                ) : (
                  <span className="text-4xl opacity-60">🚗</span>
                )}
              </div>

              <div className="text-[10px] uppercase tracking-widest text-accent">{m.brand}</div>
              <div className="font-bold text-lg leading-tight">{m.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {m.bodyType} • {m.fuelType}
                {m.seatingCapacity && m.seatingCapacity !== "Not Available" ? ` • ${m.seatingCapacity} seats` : ""}
              </div>

              {m.priceLabel !== "Not Available" && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 px-2.5 py-1.5 text-sm font-semibold text-primary self-start">
                  <IndianRupee className="h-3.5 w-3.5" /> {m.priceLabel}
                </div>
              )}

              {/* Key verified specs */}
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
                {m.specs.fuelEconomyOrRange !== "Not Available" && (
                  <span className="glass rounded-full px-2 py-1">{m.specs.fuelEconomyOrRange}</span>
                )}
                {m.specs.horsepower !== "Not Available" && (
                  <span className="glass rounded-full px-2 py-1">{m.specs.horsepower}</span>
                )}
                {m.specs.zeroToHundred !== "Not Available" && (
                  <span className="glass rounded-full px-2 py-1">0-100: {m.specs.zeroToHundred}</span>
                )}
                {m.specs.safety !== "Not Available" && (
                  <span className="glass rounded-full px-2 py-1">🛡 {m.specs.safety}</span>
                )}
              </div>

              {/* Why it matches */}
              <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                {m.why.map((w, j) => (
                  <li key={j} className="flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">✓</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
              {m.highlight && (
                <p className="mt-2 text-xs text-muted-foreground/70 italic">{m.highlight}</p>
              )}

              <div className="mt-auto pt-4 flex gap-2">
                <Link
                  to="/car/$name"
                  params={{ name: encodeURIComponent(m.name) }}
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent px-3 py-2 text-center text-xs font-semibold text-primary-foreground inline-flex items-center justify-center gap-1.5 hover:opacity-90 transition"
                >
                  <Eye className="h-3.5 w-3.5" /> View Car
                </Link>
                <button
                  onClick={() => onToggleCompare(m.id)}
                  aria-pressed={selected.has(m.id)}
                  className={
                    selected.has(m.id)
                      ? "flex-1 rounded-xl bg-primary/25 border border-primary/60 px-3 py-2 text-xs font-semibold text-primary inline-flex items-center justify-center gap-1.5 transition"
                      : "flex-1 rounded-xl glass px-3 py-2 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:border-primary/50 transition"
                  }
                >
                  <GitCompare className="h-3.5 w-3.5" />
                  {selected.has(m.id) ? "Selected" : "Compare"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {excluded.length > 0 && <ExcludedPanel excluded={excluded} />}
    </div>
  );
}

function ExcludedPanel({ excluded }: { excluded: { name: string; reason: string }[] }) {
  const [open, setOpen] = useState(false);
  const shown = open ? excluded : excluded.slice(0, 5);
  return (
    <div className="mt-8 glass rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Info className="h-4 w-4 text-accent" />
        <p className="text-sm font-semibold">
          {excluded.length} candidate car{excluded.length > 1 ? "s" : ""} filtered out — and why
        </p>
      </div>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        {shown.map((e, i) => (
          <li key={i}>
            <span className="font-medium text-foreground/80">{e.name}</span> — {e.reason}
          </li>
        ))}
      </ul>
      {excluded.length > 5 && (
        <button
          onClick={() => setOpen(!open)}
          className="mt-3 text-xs text-primary inline-flex items-center gap-1 hover:underline"
        >
          {open ? "Show less" : `Show all ${excluded.length}`} <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
