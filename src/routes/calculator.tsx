import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { fetchCarSpecs, type CarSpec } from "@/lib/car.functions";
import { carId, idToQuery } from "@/lib/car-id";
import {
  calculateOwnership,
  classifyFuel,
  defaultAssumptions,
  EFFICIENCY_UNIT,
  ENERGY_UNIT,
  FUEL_CATEGORY_OPTIONS,
  formatInr,
  formatUsd,
  OWNERSHIP_PERIODS,
  prefillFromSpec,
  type CarAssumptions,
  type OwnershipResult,
} from "@/lib/cost-calculator";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  Plus,
  X,
  Calculator,
  Loader2,
  AlertCircle,
  IndianRupee,
  Fuel,
  Wrench,
  ShieldCheck,
  FileText,
  RefreshCcw,
  TrendingDown,
  Trophy,
} from "lucide-react";

const searchSchema = z.object({
  cars: z.string().optional(),
});

export const Route = createFileRoute("/calculator")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Car Ownership Cost Calculator | VIP DriveVerse" },
      { name: "description", content: "Estimate the true cost of owning any car — fuel or energy, maintenance, insurance, registration and loan interest — and compare up to 3 cars side by side." },
      { property: "og:title", content: "Car Ownership Cost Calculator | VIP DriveVerse" },
      { property: "og:description", content: "Estimate the true cost of owning any car and compare up to 3 cars side by side over 1, 3, 5 or 10 years." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalculatorPage,
});

/**
 * Car slots use the same stable unique ids as Search, Details, Compare and
 * Rankings — a slot picked here can never turn into a different model.
 */
type Slot = { id: string; query: string };

function parseSlots(raw: string | undefined): Slot[] {
  if (!raw) return [];
  const out: Slot[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const query = part.trim();
    if (!query) continue;
    const id = carId(query);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, query: idToQuery(id) });
    if (out.length >= 3) break;
  }
  return out;
}

const MAX_SLOTS = 3;

function CalculatorPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const slots = useMemo(() => parseSlots(search.cars), [search.cars]);
  const [input, setInput] = useState("");
  const [ownershipYears, setOwnershipYears] = useState<number>(5);
  const [usdRate, setUsdRate] = useState<number>(84);

  // Per-car editable assumptions, keyed by the car's stable unique id.
  const [assumptions, setAssumptions] = useState<Record<string, CarAssumptions>>({});
  const [initialized, setInitialized] = useState<Record<string, boolean>>({});

  const results = useQueries({
    queries: slots.map((slot) => ({
      // Same key as Search/Compare — the shared spec cache is reused, no extra
      // AI calls when the car was already fetched elsewhere in the app.
      queryKey: ["car", slot.id],
      queryFn: () => fetchCarSpecs({ data: { query: slot.query } }),
      staleTime: 1000 * 60 * 60,
    })),
  });

  // Prefill assumptions from verified spec values exactly once per car.
  // Keyed on the loaded spec ids so the effect re-runs when AI specs arrive.
  const loadedSpecKey = slots.map((s, i) => results[i]?.data?.id ?? "-").join("|");
  useEffect(() => {
    slots.forEach((slot, i) => {
      const spec = results[i]?.data;
      if (!spec || !spec.found || spec.id !== slot.id) return;
      if (initialized[slot.id]) return;
      setAssumptions((prev) => ({ ...prev, [slot.id]: prefillFromSpec(spec) }));
      setInitialized((prev) => ({ ...prev, [slot.id]: true }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedSpecKey, initialized]);

  const setSlots = (next: Slot[]) =>
    navigate({
      to: "/calculator",
      search: { cars: next.map((s) => s.id).join(",") || undefined },
      replace: true,
    });

  const addCar = () => {
    const value = input.trim();
    if (!value || slots.length >= MAX_SLOTS) return;
    const id = carId(value);
    if (!id || slots.some((s) => s.id === id)) {
      setInput("");
      return;
    }
    setSlots([...slots, { id, query: idToQuery(id) }]);
    setInput("");
  };

  const removeCar = (id: string) => {
    setSlots(slots.filter((s) => s.id !== id));
    setAssumptions((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setInitialized((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateAssumptions = (id: string, patch: Partial<CarAssumptions>) =>
    setAssumptions((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const updateLoan = (id: string, patch: Partial<CarAssumptions["loan"]>) =>
    setAssumptions((prev) => ({
      ...prev,
      [id]: { ...prev[id], loan: { ...prev[id].loan, ...patch } },
    }));

  const settled = slots.length >= 1 && results.every((r) => !r.isLoading);
  const verifiedCars: CarSpec[] = slots
    .map((slot, i) => {
      const spec = results[i]?.data;
      if (!spec || !spec.found || spec.id !== slot.id) return null;
      return spec;
    })
    .filter((s): s is CarSpec => s !== null);

  const missing = slots.filter((slot, i) => {
    const spec = results[i]?.data;
    return settled && (!spec || !spec.found || spec.id !== slot.id);
  });

  const computed = verifiedCars
    .filter((c) => assumptions[c.id])
    .map((c) => ({
      spec: c,
      assumptions: assumptions[c.id],
      result: calculateOwnership(assumptions[c.id], ownershipYears),
    }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs mb-4">
          <Calculator className="h-3.5 w-3.5 text-accent" /> Ownership Cost Calculator
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold">Car Ownership <span className="gradient-text">Cost Calculator</span></h1>
        <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
          See what a car really costs to own — fuel or energy, maintenance, insurance, registration and loan
          interest — then compare up to 3 cars side by side. Values prefilled from listed specs are editable
          estimates; anything not listed starts blank for you to enter.
        </p>
      </div>

      {/* Car selection */}
      <div className="glass-strong rounded-2xl p-4 mb-6 max-w-3xl mx-auto">
        <div className="flex flex-wrap gap-2 mb-3">
          {slots.map((slot, i) => {
            const spec = results[i]?.data;
            const label = spec?.found && spec.id === slot.id ? spec.name : slot.query;
            return (
              <div key={slot.id} className="rounded-full bg-primary/20 border border-primary/40 px-3 py-1.5 text-sm flex items-center gap-2">
                {label}
                <button aria-label={`Remove ${label}`} onClick={() => removeCar(slot.id)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
        {slots.length < MAX_SLOTS && (
          <form onSubmit={(e) => { e.preventDefault(); addCar(); }} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={slots.length === 0 ? "Search a car, e.g. Hyundai Creta..." : "Add another car..."}
              className="flex-1 rounded-xl bg-white/5 border border-border px-4 py-2.5 text-sm outline-none focus:border-primary"
            />
            <button className="rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-2.5 text-sm font-semibold text-primary-foreground inline-flex items-center gap-1">
              <Plus className="h-4 w-4" /> Add
            </button>
          </form>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Add 1 car for a personal estimate, or 2–3 cars to compare side by side.
        </p>
      </div>

      {/* Shared controls: ownership period + currency */}
      <div className="glass rounded-2xl p-4 mb-8 flex flex-wrap items-center gap-4 justify-center">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Own for</span>
          {OWNERSHIP_PERIODS.map((y) => (
            <button
              key={y}
              onClick={() => setOwnershipYears(y)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                ownershipYears === y
                  ? "bg-gradient-to-r from-primary to-accent text-primary-foreground"
                  : "border border-border hover:bg-white/5"
              }`}
            >
              {y} {y === 1 ? "year" : "years"}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="uppercase tracking-wider">₹ → $ rate</span>
          <NumberInput
            value={usdRate}
            onChange={setUsdRate}
            className="w-20"
            ariaLabel="Rupees per US dollar exchange rate"
          />
        </label>
      </div>

      {slots.length >= 1 && !settled && (
        <div className="text-center py-16 glass rounded-3xl">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Fetching listed specifications...</p>
        </div>
      )}

      {settled && missing.length > 0 && (
        <div className="glass rounded-2xl p-5 mb-8 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold">Car not found</p>
            <p className="text-muted-foreground">
              We couldn't verify {missing.map((m) => `"${m.query}"`).join(", ")}. We never substitute a similar
              model — check the spelling or remove it.
            </p>
          </div>
        </div>
      )}

      {/* Per-car panels */}
      {computed.map(({ spec, assumptions: a, result }) => (
        <CarCalculatorPanel
          key={spec.id}
          spec={spec}
          assumptions={a}
          result={result}
          ownershipYears={ownershipYears}
          usdRate={usdRate}
          onAssumptions={(patch) => updateAssumptions(spec.id, patch)}
          onLoan={(patch) => updateLoan(spec.id, patch)}
          onFuelCategory={(fuel) => {
            const prev = a.fuelCategory;
            // When the price is still this fuel's default, follow the new fuel's
            // default; a user-entered price is kept untouched.
            const wasDefault = a.fuelPrice === DEFAULT_ENERGY_PRICE[prev];
            updateAssumptions(spec.id, {
              fuelCategory: fuel,
              fuelPrice: wasDefault ? DEFAULT_ENERGY_PRICE[fuel] : a.fuelPrice,
              ...(prev !== fuel ? { efficiency: 0 } : {}),
            });
          }}
        />
      ))}

      {computed.length >= 2 && <ComparisonSummary rows={computed} usdRate={usdRate} />}
    </div>
  );
}

/* ------------------------------ inputs ------------------------------ */

function NumberInput({
  value,
  onChange,
  className = "",
  ariaLabel,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === 0 ? "" : String(value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value === 0 ? "" : String(value));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="decimal"
      min="0"
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={text}
      onFocus={() => { focused.current = true; }}
      onChange={(e) => {
        const v = e.target.value;
        setText(v);
        const n = parseFloat(v);
        if (Number.isFinite(n) && n >= 0) onChange(n);
      }}
      onBlur={() => {
        focused.current = false;
        const n = parseFloat(text);
        if (!Number.isFinite(n) || n < 0) {
          setText("");
          onChange(0);
        } else {
          setText(String(n));
        }
      }}
      className={`rounded-xl bg-white/5 border border-border px-3 py-2 text-sm outline-none focus:border-primary ${className}`}
    />
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
  hint,
  className = "",
}: {
  label: string;
  unit?: string;
  value: number;
  onChange: (n: number) => void;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      <span className="flex items-center gap-2">
        <NumberInput value={value} onChange={onChange} className="w-full" ariaLabel={label} />
        {unit && <span className="text-xs text-muted-foreground whitespace-nowrap">{unit}</span>}
      </span>
      {hint && <span className="block mt-1 text-[11px] text-muted-foreground/80">{hint}</span>}
    </label>
  );
}

/* --------------------------- per-car panel --------------------------- */

function CarCalculatorPanel({
  spec,
  assumptions: a,
  result,
  ownershipYears,
  usdRate,
  onAssumptions,
  onLoan,
  onFuelCategory,
}: {
  spec: CarSpec;
  assumptions: CarAssumptions;
  result: OwnershipResult;
  ownershipYears: number;
  usdRate: number;
  onAssumptions: (patch: Partial<CarAssumptions>) => void;
  onLoan: (patch: Partial<CarAssumptions["loan"]>) => void;
  onFuelCategory: (fuel: CarAssumptions["fuelCategory"]) => void;
}) {
  const effKnown = a.efficiency > 0;
  return (
    <div className="glass-strong rounded-3xl p-6 mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="text-xs text-accent uppercase tracking-widest">{spec.brand}</div>
          <h2 className="text-2xl font-bold leading-tight">{spec.name}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {spec.bodyType} • {spec.fuelType} • {spec.modelYear}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total over {ownershipYears} {ownershipYears === 1 ? "year" : "years"}</div>
          <div className="text-2xl font-bold gradient-text">{formatInr(result.totalExpenditure)}</div>
          <div className="text-xs text-muted-foreground">{formatUsd(result.totalExpenditure, usdRate)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Editable assumptions */}
        <div>
          <h3 className="text-sm font-semibold mb-3 inline-flex items-center gap-2">
            <FileText className="h-4 w-4 text-accent" /> Your assumptions <span className="text-xs font-normal text-muted-foreground">(editable — prefilled from listed specs where available)</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Purchase price (on-road)"
              unit="₹ lakh"
              value={a.purchasePriceLakh}
              onChange={(n) => onAssumptions({ purchasePriceLakh: n })}
              hint={a.purchasePriceLakh > 0 ? "Prefilled from listed price range" : "Not listed — enter the price you'd pay"}
            />
            <Field
              label="Registration & initial costs"
              unit="₹"
              value={a.registrationCost}
              onChange={(n) => onAssumptions({ registrationCost: n })}
              hint="One-time: registration, road tax, accessories"
            />
            <Field
              label="Annual kilometres"
              unit="km"
              value={a.annualKm}
              onChange={(n) => onAssumptions({ annualKm: n })}
            />
            <label className="block">
              <span className="block text-xs font-medium text-muted-foreground mb-1">Fuel / energy type</span>
              <select
                value={a.fuelCategory}
                onChange={(e) => onFuelCategory(e.target.value as CarAssumptions["fuelCategory"])}
                className="w-full rounded-xl bg-white/5 border border-border px-3 py-2 text-sm outline-none focus:border-primary"
                aria-label="Fuel or energy type"
              >
                {FUEL_CATEGORY_OPTIONS.map((f) => (
                  <option key={f.key} value={f.key} className="bg-background">{f.label}</option>
                ))}
              </select>
              <span className="block mt-1 text-[11px] text-muted-foreground/80">
                Listed: {spec.fuelType}
              </span>
            </label>
            <Field
              label={`Energy price (${ENERGY_UNIT[a.fuelCategory]})`}
              value={a.fuelPrice}
              onChange={(n) => onAssumptions({ fuelPrice: n })}
              hint="Typical street price — edit for your city"
            />
            <Field
              label={`Mileage / efficiency (${EFFICIENCY_UNIT[a.fuelCategory]})`}
              value={a.efficiency}
              onChange={(n) => onAssumptions({ efficiency: n })}
              hint={
                effKnown
                  ? "Prefilled from listed mileage/range"
                  : "Not listed for this fuel — enter your real-world figure"
              }
            />
            <Field
              label="Annual maintenance"
              unit="₹"
              value={a.annualMaintenance}
              onChange={(n) => onAssumptions({ annualMaintenance: n })}
              hint="Average yearly servicing & repairs"
            />
            <Field
              label="Annual insurance"
              unit="₹"
              value={a.annualInsurance}
              onChange={(n) => onAssumptions({ annualInsurance: n })}
            />
            <Field
              label="Resale value after period"
              unit="% of price"
              value={a.resalePercent}
              onChange={(n) => onAssumptions({ resalePercent: n })}
              hint="Your estimate — left blank the resale is ₹0"
              className="col-span-2"
            />
          </div>

          <h3 className="text-sm font-semibold mt-5 mb-3 inline-flex items-center gap-2">
            <IndianRupee className="h-4 w-4 text-accent" /> Loan (optional)
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Down payment"
              unit="₹ lakh"
              value={a.loan.downPaymentLakh}
              onChange={(n) => onLoan({ downPaymentLakh: n })}
            />
            <Field
              label="Interest rate"
              unit="% / year"
              value={a.loan.interestRatePct}
              onChange={(n) => onLoan({ interestRatePct: n })}
            />
            <Field
              label="Loan tenure"
              unit="years"
              value={a.loan.years}
              onChange={(n) => onLoan({ years: n })}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Estimated flat-rate interest on the loan amount over {result.loanAppliedYears || 0}{" "}
            {result.loanAppliedYears === 1 ? "year" : "years"} (capped at the ownership period). The loan principal
            and down payment are part of the purchase price, so they are never added twice.
          </p>
        </div>

        {/* Results */}
        <div>
          <h3 className="text-sm font-semibold mb-3 inline-flex items-center gap-2">
            <RefreshCcw className="h-4 w-4 text-accent" /> Results <span className="text-xs font-normal text-muted-foreground">(recalculated instantly)</span>
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="glass rounded-2xl p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg. yearly cost</div>
              <div className="text-lg font-bold mt-1">{formatInr(result.yearly)}</div>
              <div className="text-xs text-muted-foreground">{formatUsd(result.yearly, usdRate)}</div>
            </div>
            <div className="glass rounded-2xl p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Avg. monthly cost</div>
              <div className="text-lg font-bold mt-1">{formatInr(result.monthly)}</div>
              <div className="text-xs text-muted-foreground">{formatUsd(result.monthly, usdRate)}</div>
            </div>
          </div>

          <div className="glass rounded-2xl p-4 mb-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Expense breakdown ({ownershipYears} {ownershipYears === 1 ? "year" : "years"})
            </div>
            <BreakdownRow icon={<CarIcon />} label="Purchase price" amount={result.purchase} usdRate={usdRate} />
            <BreakdownRow icon={<FileText className="h-4 w-4" />} label="Registration & initial" amount={result.registration} usdRate={usdRate} />
            <BreakdownRow icon={<Fuel className="h-4 w-4" />} label={a.fuelCategory === "electric" ? "Electricity" : "Fuel"} amount={result.fuel} usdRate={usdRate} />
            <BreakdownRow icon={<Wrench className="h-4 w-4" />} label="Maintenance" amount={result.maintenance} usdRate={usdRate} />
            <BreakdownRow icon={<ShieldCheck className="h-4 w-4" />} label="Insurance" amount={result.insurance} usdRate={usdRate} />
            <BreakdownRow icon={<IndianRupee className="h-4 w-4" />} label="Loan interest" amount={result.loanInterest} usdRate={usdRate} />
            <div className="border-t border-border/50 mt-2 pt-2 flex justify-between text-sm font-bold">
              <span>Total expenditure</span>
              <span>
                {formatInr(result.totalExpenditure)}
                <span className="block text-[11px] font-normal text-muted-foreground">{formatUsd(result.totalExpenditure, usdRate)}</span>
              </span>
            </div>
          </div>

          <div className="glass rounded-2xl p-4">
            <BreakdownRow
              icon={<TrendingDown className="h-4 w-4" />}
              label="Estimated resale value"
              amount={result.resale}
              usdRate={usdRate}
              note={a.resalePercent > 0 ? `${a.resalePercent}% of the purchase price` : "not set — treat as ₹0"}
            />
            <BreakdownRow icon={<TrendingDown className="h-4 w-4" />} label="Depreciation" amount={result.depreciation} usdRate={usdRate} />
            <div className="border-t border-border/50 mt-2 pt-3 rounded-xl bg-primary/10 border border-primary/30 px-3 py-2 flex justify-between items-center -mx-3 -mt-1">
              <div>
                <div className="text-xs font-semibold text-primary uppercase tracking-wider">Net ownership cost</div>
                <div className="text-[11px] text-muted-foreground">after subtracting resale</div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold gradient-text">{formatInr(result.netCost)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {formatUsd(result.netCost, usdRate)} • {formatInr(result.netMonthly)}/mo
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
      <circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" />
    </svg>
  );
}

function BreakdownRow({
  icon,
  label,
  amount,
  usdRate,
  note,
}: {
  icon: React.ReactNode;
  label: string;
  amount: number;
  usdRate: number;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span className="text-accent/80">{icon}</span>
        {label}
        {note && <span className="text-[11px] text-muted-foreground/70">({note})</span>}
      </span>
      <span className="font-medium text-right">
        {formatInr(amount)}
        <span className="block text-[11px] font-normal text-muted-foreground">{formatUsd(amount, usdRate)}</span>
      </span>
    </div>
  );
}

/* ------------------------ side-by-side comparison ------------------------ */

const COMPARE_ROWS: { label: string; pick: (r: OwnershipResult) => number; lowerIsBetter?: boolean }[] = [
  { label: "Total expenditure", pick: (r) => r.totalExpenditure, lowerIsBetter: true },
  { label: "Net cost (after resale)", pick: (r) => r.netCost, lowerIsBetter: true },
  { label: "Avg. monthly cost", pick: (r) => r.monthly, lowerIsBetter: true },
  { label: "Avg. yearly cost", pick: (r) => r.yearly, lowerIsBetter: true },
  { label: "Purchase price", pick: (r) => r.purchase },
  { label: "Registration & initial", pick: (r) => r.registration },
  { label: "Fuel / electricity", pick: (r) => r.fuel },
  { label: "Maintenance", pick: (r) => r.maintenance },
  { label: "Insurance", pick: (r) => r.insurance },
  { label: "Loan interest", pick: (r) => r.loanInterest },
  { label: "Resale value", pick: (r) => r.resale, lowerIsBetter: false },
  { label: "Depreciation", pick: (r) => r.depreciation, lowerIsBetter: true },
];

function ComparisonSummary({
  rows,
  usdRate,
}: {
  rows: { spec: CarSpec; result: OwnershipResult }[];
  usdRate: number;
}) {
  return (
    <div className="glass-strong rounded-3xl p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center glow">
          <Trophy className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Side-by-Side Comparison</h2>
          <p className="text-xs text-muted-foreground">Same ownership period, each car with its own assumptions</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid" style={{ gridTemplateColumns: `220px repeat(${rows.length}, minmax(0, 1fr))` }}>
            <div className="p-3 border-b border-border/50" />
            {rows.map(({ spec }) => (
              <div key={spec.id} className="p-3 border-b border-border/50 border-l border-l-border/50">
                <div className="text-xs text-accent uppercase tracking-widest">{spec.brand}</div>
                <div className="font-bold leading-tight mt-0.5">{spec.name}</div>
              </div>
            ))}
            {COMPARE_ROWS.map((row) => {
              const values = rows.map((r) => row.pick(r.result));
              const best =
                row.lowerIsBetter !== undefined && values.some((v) => v > 0)
                  ? row.lowerIsBetter
                    ? Math.min(...values)
                    : Math.max(...values)
                  : null;
              return (
                <div key={row.label} className="contents">
                  <div className="p-3 text-sm text-muted-foreground border-b border-border/30 bg-white/[0.02]">{row.label}</div>
                  {rows.map((r, i) => {
                    const v = values[i];
                    const isBest = best !== null && v === best;
                    return (
                      <div
                        key={r.spec.id + row.label}
                        className={`p-3 text-sm border-b border-border/30 border-l border-l-border/50 font-medium ${isBest ? "text-primary" : ""}`}
                      >
                        {formatInr(v)}
                        {isBest && <span className="ml-1" title="Best in this row">★</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {(() => {
        const bestNet = rows.reduce((a, b) => (b.result.netCost < a.result.netCost ? b : a));
        return (
          <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
            <span className="font-semibold text-primary">Lowest net ownership cost: </span>
            {bestNet.spec.name} at {formatInr(bestNet.result.netCost)} ({formatUsd(bestNet.result.netCost, usdRate)}) over the selected period.
          </div>
        );
      })()}
    </div>
  );
}
