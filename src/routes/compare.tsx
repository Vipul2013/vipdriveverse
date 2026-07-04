import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchCarSpecs, compareCarsAI, type CarSpec } from "@/lib/car.functions";
import { useState } from "react";
import { z } from "zod";
import { Plus, X, Sparkles, GitCompare, Trophy, Loader2 } from "lucide-react";

const searchSchema = z.object({
  cars: z.string().optional(),
});

export const Route = createFileRoute("/compare")({
  validateSearch: searchSchema,
  component: ComparePage,
});

function ComparePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const initial = search.cars ? search.cars.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 3) : [];
  const [cars, setCars] = useState<string[]>(initial);
  const [input, setInput] = useState("");

  const results = useQueries({
    queries: cars.map((c) => ({
      queryKey: ["car", c],
      queryFn: () => fetchCarSpecs({ data: { query: c } }),
      staleTime: 1000 * 60 * 60,
    })),
  });

  const allLoaded = cars.length >= 2 && results.every((r) => r.data && !r.isLoading);
  const foundCars = results.filter((r) => r.data?.found).map((r) => r.data!) as CarSpec[];

  const comparison = useQuery({
    queryKey: ["compare", foundCars.map((c) => c.name).join("|")],
    queryFn: () => compareCarsAI({ data: { cars: foundCars.map((c) => c.name) } }),
    enabled: allLoaded && foundCars.length >= 2,
    staleTime: 1000 * 60 * 60,
  });

  const addCar = () => {
    if (!input.trim() || cars.length >= 3) return;
    const next = [...cars, input.trim()];
    setCars(next);
    setInput("");
    navigate({ to: "/compare", search: { cars: next.join(",") }, replace: true });
  };

  const removeCar = (i: number) => {
    const next = cars.filter((_, idx) => idx !== i);
    setCars(next);
    navigate({ to: "/compare", search: { cars: next.join(",") || undefined }, replace: true });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs mb-4">
          <GitCompare className="h-3.5 w-3.5 text-accent" /> Compare up to 3 cars
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold">AI Car <span className="gradient-text">Comparison</span></h1>
        <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
          Add cars and get a balanced AI recommendation for different use cases.
        </p>
      </div>

      {/* Car input */}
      <div className="glass-strong rounded-2xl p-4 mb-8 max-w-3xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-3">
          {cars.map((c, i) => (
            <div key={i} className="rounded-full bg-primary/20 border border-primary/40 px-3 py-1.5 text-sm flex items-center gap-2">
              {c}
              <button onClick={() => removeCar(i)}><X className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        {cars.length < 3 && (
          <form onSubmit={(e) => { e.preventDefault(); addCar(); }} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={cars.length === 0 ? "Add first car..." : "Add another car..."}
              className="flex-1 rounded-xl bg-white/5 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button className="rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground inline-flex items-center gap-1">
              <Plus className="h-4 w-4" /> Add
            </button>
          </form>
        )}
        {cars.length < 2 && (
          <p className="mt-3 text-xs text-muted-foreground">Add at least 2 cars to start comparing.</p>
        )}
      </div>

      {cars.length >= 2 && (
        <>
          {/* Loading */}
          {!allLoaded && (
            <div className="text-center py-16 glass rounded-3xl">
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">Fetching AI specs for each vehicle...</p>
            </div>
          )}

          {allLoaded && foundCars.length < 2 && (
            <div className="text-center py-16 glass rounded-3xl">
              <p>We couldn't find enough of these cars to compare. Please check the names.</p>
            </div>
          )}

          {allLoaded && foundCars.length >= 2 && (
            <>
              <ComparisonTable cars={foundCars} />
              <AIAnalysis
                loading={comparison.isLoading}
                data={comparison.data}
                cars={foundCars.map((c) => c.name)}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

const SPEC_ROWS: [string, keyof CarSpec][] = [
  ["Price", "priceRange"],
  ["Engine", "engine"],
  ["Horsepower", "horsepower"],
  ["Torque", "torque"],
  ["Top Speed", "topSpeed"],
  ["0-100 km/h", "zeroToHundred"],
  ["Transmission", "transmission"],
  ["Drivetrain", "drivetrain"],
  ["Fuel Type", "fuelType"],
  ["Length", "length"],
  ["Width", "width"],
  ["Height", "height"],
  ["Wheelbase", "wheelbase"],
  ["Ground Clearance", "groundClearance"],
  ["Boot Space", "bootSpace"],
  ["Fuel Tank / Battery", "fuelTankOrBattery"],
  ["Seating", "seatingCapacity"],
  ["Mileage / Range", "fuelEconomyOrRange"],
  ["Safety", "safety"],
  ["Wheel Size", "wheelSize"],
];

function ComparisonTable({ cars }: { cars: CarSpec[] }) {
  return (
    <div className="glass-strong rounded-3xl overflow-hidden mb-10">
      <div className="grid" style={{ gridTemplateColumns: `200px repeat(${cars.length}, minmax(0, 1fr))` }}>
        {/* Header */}
        <div className="p-5 border-b border-border/50" />
        {cars.map((c) => (
          <div key={c.name} className="p-5 border-b border-border/50 border-l border-l-border/50">
            <div className="text-xs text-accent uppercase tracking-widest">{c.brand}</div>
            <div className="font-bold text-lg mt-1 leading-tight">{c.name}</div>
            <div className="mt-2 text-xs text-muted-foreground">{c.bodyType} • {c.modelYear}</div>
          </div>
        ))}
        {/* Rows */}
        {SPEC_ROWS.map(([label, key]) => (
          <div key={key} className="contents">
            <div className="p-4 text-sm text-muted-foreground border-b border-border/30 bg-white/[0.02]">{label}</div>
            {cars.map((c) => (
              <div key={c.name + key} className="p-4 text-sm border-b border-border/30 border-l border-l-border/50 font-medium">
                {(c[key] as string) || "Not Available"}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function AIAnalysis({ loading, data, cars }: { loading: boolean; data: any; cars: string[] }) {
  if (loading) {
    return (
      <div className="glass-strong rounded-3xl p-12 text-center">
        <Sparkles className="h-8 w-8 mx-auto text-accent animate-pulse mb-3" />
        <p>AI is analyzing the comparison...</p>
      </div>
    );
  }
  if (!data) return null;

  const categories: [string, string][] = [
    ["Overall Best", data.overallBest],
    ["Best for Families", data.bestForFamilies],
    ["Best for City Driving", data.bestForCity],
    ["Best for Highway", data.bestForHighway],
    ["Best for Off-Roading", data.bestForOffroad],
    ["Best for Performance", data.bestForPerformance],
    ["Best for Mileage", data.bestForMileage],
    ["Best for Budget", data.bestForBudget],
    ["Best for Luxury", data.bestForLuxury],
    ["Best for Long-Term", data.bestForLongTerm],
  ];

  return (
    <div className="glass-strong rounded-3xl p-8 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none"
           style={{ background: "radial-gradient(circle at 0% 100%, oklch(0.78 0.16 210 / 60%), transparent 60%)" }} />
      <div className="relative">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow">
            <Trophy className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Recommendation</h2>
            <p className="text-xs text-muted-foreground">Balanced analysis across {cars.length} vehicles</p>
          </div>
        </div>

        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 mb-6">
          <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Final Verdict</div>
          <p className="text-base leading-relaxed">{data.finalVerdict}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map(([title, content]) => (
            <div key={title} className="glass rounded-xl p-4">
              <div className="text-xs font-semibold text-accent uppercase tracking-wider mb-1.5">{title}</div>
              <p className="text-sm text-muted-foreground leading-relaxed">{content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
