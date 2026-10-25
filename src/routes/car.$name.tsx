import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCarSpecs, type CarSpec } from "@/lib/car.functions";
import { carId } from "@/lib/car-id";
import { fetchCarImages } from "@/lib/car-images.functions";
import { fetchEngineOptions, type EngineOption } from "@/lib/engine.functions";
import { addToDreamGarage } from "@/lib/dream-garage.functions";
import { getDreamUser } from "@/lib/dream-auth.functions";
import { AlertCircle, ArrowLeft, Check, X, Sparkles, GitCompare, Ruler, Fuel, Shield, DollarSign, Cog, Car, ImageOff, ChevronLeft, ChevronRight, Heart, Zap } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/car/$name")({
  validateSearch: z.object({ fuel: z.string().optional() }),
  component: CarPage,
});

function CarPage() {
  const { name } = Route.useParams();
  const search = Route.useSearch();
  const query = decodeURIComponent(name);
  const fuel = search.fuel?.trim() || undefined;

  const { data, isLoading, error } = useQuery({
    queryKey: ["car", query, fuel ?? ""],
    queryFn: () => fetchCarSpecs({ data: { query, fuel } }),
    staleTime: 1000 * 60 * 60,
  });

  if (isLoading) return <LoadingState query={query} />;
  if (error) return <ErrorState message={(error as Error).message} />;
  if (!data) return null;
  if (!data.found) return <NotFoundState query={query} fuel={fuel} />;

  return <CarDetail spec={data} />;
}

function LoadingState({ query }: { query: string }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-24 text-center">
      <div className="glass-strong rounded-3xl p-12 glow">
        <Sparkles className="h-10 w-10 mx-auto text-accent animate-pulse mb-4" />
        <h1 className="text-2xl font-bold">Researching <span className="gradient-text">{query}</span></h1>
        <p className="mt-3 text-muted-foreground">Our AI is fetching specifications and analysis...</p>
        <div className="mt-6 h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-primary to-accent animate-pulse" style={{ width: "70%" }} />
        </div>
      </div>
    </div>
  );
}

function NotFoundState({ query, fuel }: { query: string; fuel?: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <div className="glass rounded-3xl p-12">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Couldn't find "{query}"</h1>
        <p className="mt-3 text-muted-foreground">
          {fuel
            ? `We couldn't verify a factory ${fuel} variant of "${query}". This model may only be available with other powertrains — try the search again without the fuel filter.`
            : "We couldn't reliably identify this vehicle. Please check the spelling or try a different model."}
        </p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          <ArrowLeft className="h-4 w-4" /> Back home
        </Link>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <div className="glass rounded-3xl p-12">
        <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-4 py-2.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "Not Available"}</span>
    </div>
  );
}

function SpecCard({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function CarDetail({ spec }: { spec: CarSpec }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addCar, setAddCar] = useState("");
  const images = qc.getQueryData<{ images: string[] }>(["car-images", spec.name]);
  const imageUrl = images?.images?.[0] ?? null;

  const { data: userData } = useQuery({ queryKey: ["dream-user"], queryFn: () => getDreamUser() });
  const addFav = useMutation({
    mutationFn: () =>
      addToDreamGarage({
        data: {
          carQuery: spec.name,
          carName: spec.name,
          brand: spec.brand,
          modelYear: spec.modelYear,
          bodyType: spec.bodyType,
          fuelType: spec.fuelType,
          imageUrl,
          summary: spec.summary,
        },
      }),
    onSuccess: (r) => {
      if (r.status === "exists") toast("This car is already in your Dream Garage.");
      else toast.success("Car added to your Dream Garage.");
      qc.invalidateQueries({ queryKey: ["dream-garage"] });
    },
    onError: (e: Error) => {
      if (/not signed in/i.test(e.message)) {
        toast.error("Please sign in to your Dream Garage first.");
        navigate({ to: "/dream-garage" });
      } else toast.error(e.message);
    },
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => addFav.mutate(undefined)}
          disabled={addFav.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition disabled:opacity-50"
        >
          <Heart className="h-4 w-4 fill-current" />
          {userData?.user ? "Add to Dream Garage" : "Sign in & Add to Dream Garage"}
        </button>
      </div>
      {/* Hero */}
      <div className="glass-strong rounded-3xl overflow-hidden mb-8">
        <CarGallery query={spec.name} bodyType={spec.bodyType} country={spec.country} />
        <div className="p-6 sm:p-8">
          <div className="text-sm text-accent font-semibold uppercase tracking-widest">{spec.brand}</div>
          <h1 className="mt-2 text-4xl sm:text-5xl font-bold">{spec.name}</h1>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Year: <span className="text-foreground font-medium">{spec.modelYear}</span></span>
            <span>Fuel: <span className="text-foreground font-medium">{spec.fuelType}</span></span>
            <span>Transmission: <span className="text-foreground font-medium">{spec.transmission}</span></span>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="glass rounded-xl px-4 py-2">
              <div className="text-[10px] text-muted-foreground uppercase">Price</div>
              <div className="font-bold text-primary">{spec.priceRange}</div>
            </div>
            <div className="glass rounded-xl px-4 py-2">
              <div className="text-[10px] text-muted-foreground uppercase">Power</div>
              <div className="font-bold">{spec.horsepower}</div>
            </div>
            <div className="glass rounded-xl px-4 py-2">
              <div className="text-[10px] text-muted-foreground uppercase">0-100 km/h</div>
              <div className="font-bold">{spec.zeroToHundred}</div>
            </div>
          </div>
        </div>
      </div>

      <EngineOptionsSection key={spec.id} spec={spec} />

      {/* Specs grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SpecCard icon={Cog} title="Engine & Performance">
          <SpecRow label="Engine" value={spec.engine} />
          <SpecRow label="Capacity" value={spec.engineCapacity} />
          <SpecRow label="Horsepower" value={spec.horsepower} />
          <SpecRow label="Torque" value={spec.torque} />
          <SpecRow label="Top Speed" value={spec.topSpeed} />
          <SpecRow label="0-100 km/h" value={spec.zeroToHundred} />
          <SpecRow label="Drivetrain" value={spec.drivetrain} />
        </SpecCard>

        <SpecCard icon={Ruler} title="Dimensions">
          <SpecRow label="Length" value={spec.length} />
          <SpecRow label="Width" value={spec.width} />
          <SpecRow label="Height" value={spec.height} />
          <SpecRow label="Wheelbase" value={spec.wheelbase} />
          <SpecRow label="Ground Clearance" value={spec.groundClearance} />
          <SpecRow label="Kerb Weight" value={spec.kerbWeight} />
          <SpecRow label="Boot Space" value={spec.bootSpace} />
        </SpecCard>

        <SpecCard icon={Fuel} title="Fuel & Range">
          <SpecRow label="Fuel Type" value={spec.fuelType} />
          <SpecRow label="Tank / Battery" value={spec.fuelTankOrBattery} />
          <SpecRow label="Economy / Range" value={spec.fuelEconomyOrRange} />
          <SpecRow label="Wheel Size" value={spec.wheelSize} />
        </SpecCard>

        <SpecCard icon={Car} title="Capacity">
          <SpecRow label="Seating" value={spec.seatingCapacity} />
          <SpecRow label="Body Type" value={spec.bodyType} />
          <SpecRow label="Country" value={spec.country} />
        </SpecCard>

        <SpecCard icon={Shield} title="Safety">
          <SpecRow label="Safety" value={spec.safety} />
        </SpecCard>

        <SpecCard icon={DollarSign} title="Price">
          <SpecRow label="Range" value={spec.priceRange} />
        </SpecCard>
      </div>

      {/* AI Expert */}
      <div className="mt-10 glass-strong rounded-3xl p-8 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 pointer-events-none"
             style={{ background: "radial-gradient(circle at 100% 0%, oklch(0.68 0.19 250 / 60%), transparent 60%)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-xl font-bold">AI Car Expert</h2>
              <p className="text-xs text-muted-foreground">Beginner-friendly analysis by Gemini</p>
            </div>
          </div>

          <p className="text-base leading-relaxed">{spec.summary}</p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-accent mb-2">Best For</h3>
              <p className="text-sm text-muted-foreground">{spec.bestUseCase}</p>
              <h3 className="text-sm font-semibold text-accent mt-4 mb-2">Target Buyers</h3>
              <p className="text-sm text-muted-foreground">{spec.targetBuyers}</p>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-green-400 mb-2">Advantages</h3>
              <ul className="space-y-1.5">
                {spec.pros.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />{p}
                  </li>
                ))}
              </ul>
              <h3 className="text-sm font-semibold text-orange-400 mt-4 mb-2">Disadvantages</h3>
              <ul className="space-y-1.5">
                {spec.cons.map((p, i) => (
                  <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                    <X className="h-4 w-4 text-orange-400 shrink-0 mt-0.5" />{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {spec.competitors.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-accent mb-3">Main Competitors</h3>
              <div className="flex flex-wrap gap-2">
                {spec.competitors.map((c) => (
                  <Link
                    key={c}
                    to="/car/$name"
                    params={{ name: encodeURIComponent(c) }}
                    className="rounded-full glass px-3 py-1.5 text-xs hover:border-primary/50 transition"
                  >{c}</Link>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Buying Advice</div>
            <p className="text-sm">{spec.buyingAdvice}</p>
          </div>
        </div>
      </div>

      {/* Compare CTA */}
      <div className="mt-8 glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <GitCompare className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Compare with another car</h3>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!addCar.trim()) return;
            navigate({ to: "/compare", search: { cars: `${spec.id},${carId(addCar.trim())}` } });
          }}
          className="flex gap-2"
        >
          <input
            value={addCar}
            onChange={(e) => setAddCar(e.target.value)}
            placeholder="e.g. Hyundai Creta"
            className="flex-1 rounded-xl bg-white/5 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
          />
          <button className="rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground">
            Compare
          </button>
        </form>
      </div>
    </div>
  );
}

function CarGallery({ query, bodyType, country }: { query: string; bodyType: string; country: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["car-images", query],
    queryFn: () => fetchCarImages({ data: { query } }),
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
  });
  const [idx, setIdx] = useState(0);
  const images = data?.images ?? [];
  const hasImages = images.length > 0;
  const current = hasImages ? images[Math.min(idx, images.length - 1)] : null;

  return (
    <div className="relative">
      <div className="relative h-64 sm:h-96 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-10 w-10 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
          </div>
        )}
        {!isLoading && current && (
          <img
            key={current}
            src={current}
            alt={query}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-500"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        {!isLoading && !hasImages && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 px-6">
            <ImageOff className="h-12 w-12 text-muted-foreground/60" />
            <div className="text-sm font-semibold text-muted-foreground">Image Not Available</div>
            <div className="text-xs text-muted-foreground/70 max-w-xs">
              We couldn't verify an authentic image for this exact model.
            </div>
          </div>
        )}
        <div className="absolute top-4 left-4 text-xs rounded-full glass px-3 py-1 backdrop-blur">
          {bodyType} • {country}
        </div>
        {hasImages && images.length > 1 && (
          <>
            <button
              onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full glass flex items-center justify-center hover:bg-white/20"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => setIdx((i) => (i + 1) % images.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full glass flex items-center justify-center hover:bg-white/20"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute bottom-3 right-4 text-[10px] rounded-full glass px-2.5 py-1">
              {idx + 1} / {images.length}
            </div>
          </>
        )}
      </div>
      {hasImages && images.length > 1 && (
        <div className="flex gap-2 p-3 overflow-x-auto scrollbar-none bg-black/20">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIdx(i)}
              className={`shrink-0 h-16 w-24 rounded-lg overflow-hidden border-2 transition ${
                i === idx ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {data?.attribution && (
        <div className="px-4 py-1.5 text-[10px] text-muted-foreground/70 bg-black/20">
          {data.attribution}
        </div>
      )}
    </div>
  );
}

const NA_LABEL = "Not Available";

const ENGINE_FIELD_ROWS: [string, (o: EngineOption) => string][] = [
  ["Engine", (o) => o.engine],
  ["Capacity", (o) => o.engineCapacity],
  ["Cylinders", (o) => o.cylinders],
  ["Power", (o) => o.power],
  ["Torque", (o) => o.torque],
  ["Transmission", (o) => o.transmission],
  ["Drivetrain", (o) => o.drivetrain],
  ["Mileage / Range", (o) => o.mileageOrRange],
  ["Price", (o) => o.price],
];

function optKey(o: EngineOption): string {
  return `${o.fittedType}|${o.variantName}|${o.fuelType}|${o.engine}`;
}

function FittedBadge({ fitted }: { fitted: "factory" | "aftermarket" }) {
  if (fitted === "aftermarket") {
    return (
      <span className="rounded-full bg-orange-400/15 border border-orange-400/40 px-2 py-0.5 text-[10px] font-semibold text-orange-300 uppercase tracking-wide">
        Aftermarket
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-400/10 border border-green-400/40 px-2 py-0.5 text-[10px] font-semibold text-green-300 uppercase tracking-wide">
      Factory-fitted
    </span>
  );
}

function EngineOptionsSection({ spec }: { spec: CarSpec }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["engine-options", spec.id],
    queryFn: () =>
      fetchEngineOptions({
        data: {
          carId: spec.id,
          carName: spec.name,
          brand: spec.brand,
          modelYear: spec.modelYear,
          country: spec.country,
        },
      }),
    staleTime: 1000 * 60 * 60 * 24,
  });

  const options = useMemo(() => data?.options ?? [], [data]);
  const fuels = useMemo(() => Array.from(new Set(options.map((o) => o.fuelType))), [options]);

  const [fuel, setFuel] = useState<string | null>(null);
  const [variantKey, setVariantKey] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const activeFuel = fuel && fuels.includes(fuel) ? fuel : fuels[0] ?? null;
  const forFuel = useMemo(
    () => (activeFuel ? options.filter((o) => o.fuelType === activeFuel) : []),
    [options, activeFuel],
  );
  const activeKey =
    variantKey && forFuel.some((o) => optKey(o) === variantKey)
      ? variantKey
      : forFuel[0]
        ? optKey(forFuel[0])
        : null;
  const selected = forFuel.find((o) => optKey(o) === activeKey) ?? null;

  const toggleCompare = (k: string) =>
    setCompareIds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : prev.length >= 3 ? prev : [...prev, k],
    );
  const compareOptions = compareIds
    .map((k) => options.find((o) => optKey(o) === k))
    .filter((o): o is EngineOption => !!o);

  return (
    <section className="mt-8 glass-strong rounded-3xl p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Engine & Fuel Options</h2>
          <p className="text-xs text-muted-foreground">
            Genuine engine / powertrain configurations for this exact car — factory-fitted options only, plus clearly-labelled aftermarket conversions where verified.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="mt-8 py-10 text-center">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground">Verifying engine and fuel options...</p>
        </div>
      )}

      {!isLoading && (error || !data?.found || options.length === 0) && (
        <div className="mt-6 rounded-2xl border border-border/50 bg-white/[0.02] p-5 text-sm text-muted-foreground">
          {error ? (
            <>Engine options are temporarily unavailable. Please try again in a moment.</>
          ) : (
            <>
              No verified engine / fuel options could be confirmed for this exact car, market and model year.
              We never list an option without evidence — so nothing is shown rather than guessed.
            </>
          )}
        </div>
      )}

      {!isLoading && !error && data?.found && options.length > 0 && (
        <>
          {/* Fuel type selector */}
          <div className="mt-6 flex flex-wrap gap-2">
            {fuels.map((f) => (
              <button
                key={f}
                onClick={() => setFuel(f)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition border ${
                  f === activeFuel
                    ? "bg-primary/25 border-primary/60 text-primary"
                    : "glass border-transparent hover:border-primary/40"
                }`}
              >
                <Fuel className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
                {f}
              </button>
            ))}
          </div>

          {/* Variant selector */}
          {forFuel.length > 1 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {forFuel.map((o) => (
                <button
                  key={optKey(o)}
                  onClick={() => setVariantKey(optKey(o))}
                  className={`rounded-xl px-3.5 py-2 text-xs font-medium transition border ${
                    optKey(o) === activeKey
                      ? "bg-white/10 border-primary/60"
                      : "glass border-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  {o.variantName}
                  {o.fittedType === "aftermarket" && <span className="ml-1.5 text-orange-300">(AM)</span>}
                </button>
              ))}
            </div>
          )}

          {/* Selected option details */}
          {selected && (
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <div className="glass rounded-2xl p-5 lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <div className="text-xs text-accent uppercase tracking-widest">{selected.fuelType}</div>
                    <div className="font-bold text-lg mt-0.5">{selected.variantName}</div>
                  </div>
                  <FittedBadge fitted={selected.fittedType} />
                </div>
                <div>
                  {ENGINE_FIELD_ROWS.map(([label, get]) => (
                    <SpecRow key={label} label={label} value={get(selected)} />
                  ))}
                </div>
                {selected.notes && (
                  <p className="mt-4 text-xs text-muted-foreground border-l-2 border-orange-400/50 pl-3">
                    {selected.notes}
                  </p>
                )}
              </div>
              <div className="glass rounded-2xl p-5 flex flex-col justify-center gap-3">
                <div className="text-xs font-semibold text-accent uppercase tracking-wider">Compare options</div>
                <p className="text-xs text-muted-foreground">
                  Pick up to 3 engine / fuel options of this car and compare them side-by-side.
                </p>
                <button
                  onClick={() => toggleCompare(optKey(selected))}
                  disabled={compareIds.length >= 3 && !compareIds.includes(optKey(selected))}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${
                    compareIds.includes(optKey(selected))
                      ? "bg-primary/25 border border-primary/60 text-primary"
                      : "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  }`}
                >
                  {compareIds.includes(optKey(selected)) ? "Added to comparison ✓" : "Add to comparison"}
                </button>
                {compareIds.length > 0 && (
                  <button
                    onClick={() => setCompareIds([])}
                    className="text-xs text-muted-foreground hover:text-foreground transition"
                  >
                    Clear selection ({compareIds.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Same-car option comparison table */}
          {compareOptions.length >= 2 && (
            <div className="mt-6 glass rounded-2xl p-4 overflow-x-auto">
              <div className="min-w-[520px]">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `150px repeat(${compareOptions.length}, minmax(0, 1fr))` }}
                >
                  <div className="p-3 border-b border-border/40" />
                  {compareOptions.map((o) => (
                    <div key={optKey(o)} className="p-3 border-b border-border/40 border-l border-l-border/40">
                      <div className="text-[10px] text-accent uppercase tracking-widest">{o.fuelType}</div>
                      <div className="font-semibold text-sm mt-0.5">{o.variantName}</div>
                      <div className="mt-1"><FittedBadge fitted={o.fittedType} /></div>
                    </div>
                  ))}
                  {[...ENGINE_FIELD_ROWS, ["Type", (o: EngineOption) => (o.fittedType === "factory" ? "Factory" : "Aftermarket")] as [string, (o: EngineOption) => string]].map(
                    ([label, get]) => (
                      <div key={label} className="contents">
                        <div className="p-3 text-xs text-muted-foreground border-b border-border/25 bg-white/[0.02]">{label}</div>
                        {compareOptions.map((o) => (
                          <div key={optKey(o) + label} className="p-3 text-sm border-b border-border/25 border-l border-l-border/40 font-medium">
                            {get(o) || NA_LABEL}
                          </div>
                        ))}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

