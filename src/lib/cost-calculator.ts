/**
 * Car Ownership Cost Calculator — pure, client-side math.
 *
 * Rules (per the product spec):
 * - Never invent vehicle data: purchase price, efficiency and fuel category are
 *   prefilled ONLY from verified spec values, everything else starts at 0/blank.
 * - Total cash expenditure counts the purchase price exactly once. The down
 *   payment and loan principal are parts of that price, never added on top;
 *   only loan interest is an extra cash outflow.
 * - Missing efficiency => fuel cost 0 (handled safely, never guessed).
 * - Resale value comes only from a user-entered percentage; net cost = total
 *   expenditure − resale; depreciation = purchase price − resale.
 *
 * Browser-safe: no server-only imports (CarSpec is a type-only import).
 */

import { parseEfficiency, parsePriceLakh } from "./finder-scoring";
import type { CarSpec } from "./car.functions";

export type FuelCategory = "petrol" | "diesel" | "cng" | "hybrid" | "electric";

export const FUEL_CATEGORY_OPTIONS: { key: FuelCategory; label: string }[] = [
  { key: "petrol", label: "Petrol" },
  { key: "diesel", label: "Diesel" },
  { key: "cng", label: "CNG" },
  { key: "hybrid", label: "Hybrid" },
  { key: "electric", label: "Electric" },
];

/** Unit the energy price is quoted in for each fuel category. */
export const ENERGY_UNIT: Record<FuelCategory, string> = {
  petrol: "₹/litre",
  diesel: "₹/litre",
  cng: "₹/kg",
  hybrid: "₹/litre",
  electric: "₹/kWh",
};

/** Unit efficiency is quoted in for each fuel category. */
export const EFFICIENCY_UNIT: Record<FuelCategory, string> = {
  petrol: "km/l",
  diesel: "km/l",
  cng: "km/kg",
  hybrid: "km/l",
  electric: "km/kWh",
};

/**
 * Editable market-price defaults for energy (NOT vehicle data — these are
 * typical Indian street prices the user can and should adjust).
 */
export const DEFAULT_ENERGY_PRICE: Record<FuelCategory, number> = {
  petrol: 105,
  diesel: 95,
  cng: 80,
  hybrid: 105,
  electric: 10,
};

export const OWNERSHIP_PERIODS = [1, 3, 5, 10] as const;

/** Classify a verbatim fuelType string into a cost-calculation category. */
export function classifyFuel(fuelType: string | undefined): FuelCategory {
  const s = (fuelType ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!s || s === "notavailable") return "petrol";
  if (s.includes("electric") || s.includes("bev")) return "electric";
  if (s.includes("cng")) return "cng";
  if (s.includes("diesel")) return "diesel";
  if (s.includes("hybrid") || s.includes("phev") || s.includes("hev")) return "hybrid";
  return "petrol";
}

export type LoanInputs = {
  /** Down payment in ₹ lakh (part of the purchase price, never added twice). */
  downPaymentLakh: number;
  /** Annual interest rate, percent. 0 = no loan. */
  interestRatePct: number;
  /** Loan tenure in years (interest accrues at most over the ownership period). */
  years: number;
};

export type CarAssumptions = {
  /** On-road purchase price in ₹ lakh. */
  purchasePriceLakh: number;
  /** One-time registration + other initial costs in ₹. */
  registrationCost: number;
  annualKm: number;
  fuelCategory: FuelCategory;
  /** Energy price in ENERGY_UNIT[fuelCategory]. */
  fuelPrice: number;
  /** Efficiency in EFFICIENCY_UNIT[fuelCategory]; 0 = unknown (fuel cost 0). */
  efficiency: number;
  annualMaintenance: number;
  annualInsurance: number;
  /** Estimated resale value after the ownership period, % of purchase price. */
  resalePercent: number;
  loan: LoanInputs;
};

export const DEFAULT_ANNUAL_KM = 10000;
export const DEFAULT_USD_RATE = 84;

export function defaultAssumptions(fuel: FuelCategory = "petrol"): CarAssumptions {
  return {
    purchasePriceLakh: 0,
    registrationCost: 0,
    annualKm: DEFAULT_ANNUAL_KM,
    fuelCategory: fuel,
    fuelPrice: DEFAULT_ENERGY_PRICE[fuel],
    efficiency: 0,
    annualMaintenance: 0,
    annualInsurance: 0,
    resalePercent: 0,
    loan: { downPaymentLakh: 0, interestRatePct: 0, years: 5 },
  };
}

function parseBatteryKwh(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = raw.toLowerCase().match(/(\d+(?:\.\d+)?)\s*kwh/);
  const n = m ? parseFloat(m[1]) : null;
  return n !== null && n > 0 && n <= 250 ? n : null;
}

/**
 * Prefill assumptions ONLY from verified spec strings. Anything the spec does
 * not verify stays at its zero/blank default for the user to enter.
 */
export function prefillFromSpec(spec: CarSpec): CarAssumptions {
  const base = defaultAssumptions(classifyFuel(spec.fuelType));
  const price = parsePriceLakh(spec.priceRange);
  if (price) {
    base.purchasePriceLakh = Math.round(((price.min + price.max) / 2) * 10) / 10;
  }
  const eff = parseEfficiency(spec.fuelEconomyOrRange);
  if (eff) {
    if (eff.ev) {
      // The spec string is a range in km; km/kWh needs the battery capacity.
      const batteryKwh = parseBatteryKwh(spec.fuelTankOrBattery);
      if (batteryKwh) base.efficiency = Math.round((eff.value / batteryKwh) * 10) / 10;
    } else {
      base.efficiency = eff.value;
    }
  }
  return base;
}

export type OwnershipResult = {
  /** Vehicle purchase price (₹), counted exactly once. */
  purchase: number;
  registration: number;
  fuel: number;
  maintenance: number;
  insurance: number;
  loanInterest: number;
  /** Total cash expenditure over the ownership period. */
  totalExpenditure: number;
  /** Estimated resale value (user-entered percentage of the price). */
  resale: number;
  /** Purchase price − resale (value the car itself loses). */
  depreciation: number;
  /** Total expenditure − resale. */
  netCost: number;
  yearly: number;
  monthly: number;
  netYearly: number;
  netMonthly: number;
  loanAmount: number;
  /** Years loan interest was actually applied for (capped by ownership). */
  loanAppliedYears: number;
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(v) ? v : 0));
}

export function calculateOwnership(
  a: CarAssumptions,
  ownershipYears: number,
): OwnershipResult {
  const years = ownershipYears > 0 ? ownershipYears : 1;
  const price = clamp(a.purchasePriceLakh, 0, 100000) * 100000;
  const reg = clamp(a.registrationCost, 0, 1e9);
  const resale = price * (clamp(a.resalePercent, 0, 100) / 100);

  const annualFuel =
    a.efficiency > 0 && a.fuelPrice > 0
      ? (clamp(a.annualKm, 0, 500000) / a.efficiency) * clamp(a.fuelPrice, 0, 10000)
      : 0;
  const fuel = annualFuel * years;
  const maintenance = clamp(a.annualMaintenance, 0, 1e7) * years;
  const insurance = clamp(a.annualInsurance, 0, 1e7) * years;

  const loanAmount = Math.max(0, price + reg - clamp(a.loan.downPaymentLakh, 0, 100000) * 100000);
  const loanAppliedYears =
    a.loan.interestRatePct > 0 ? Math.min(clamp(a.loan.years, 0, 30), years) : 0;
  const loanInterest = loanAmount * (clamp(a.loan.interestRatePct, 0, 100) / 100) * loanAppliedYears;

  const purchase = price;
  const totalExpenditure = purchase + reg + fuel + maintenance + insurance + loanInterest;
  const netCost = totalExpenditure - resale;

  return {
    purchase,
    registration: reg,
    fuel,
    maintenance,
    insurance,
    loanInterest,
    totalExpenditure,
    resale,
    depreciation: Math.max(0, purchase - resale),
    netCost,
    yearly: totalExpenditure / years,
    monthly: totalExpenditure / (years * 12),
    netYearly: netCost / years,
    netMonthly: netCost / (years * 12),
    loanAmount,
    loanAppliedYears,
  };
}

/** Compact Indian formatting: lakh for big values, absolute rupees otherwise. */
export function formatInr(rupees: number): string {
  const r = Math.round(rupees);
  if (Math.abs(r) >= 100000) {
    return `₹${(r / 100000).toLocaleString("en-IN", { maximumFractionDigits: 2 })} lakh`;
  }
  return `₹${r.toLocaleString("en-IN")}`;
}

/** Approximate US-dollar equivalent using a user-editable exchange rate. */
export function formatUsd(rupees: number, usdRate: number): string {
  if (!Number.isFinite(usdRate) || usdRate <= 0) return "";
  return `≈ $${Math.round(rupees / usdRate).toLocaleString("en-US")}`;
}
