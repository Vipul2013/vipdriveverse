import { describe, expect, test } from "bun:test";
import {
  calculateOwnership,
  classifyFuel,
  defaultAssumptions,
  formatInr,
  formatUsd,
  prefillFromSpec,
  type CarAssumptions,
  type CarSpec,
} from "./cost-calculator";

function spec(overrides: Partial<CarSpec>): CarSpec {
  const na = "Not Available";
  return {
    found: true,
    id: "test-car",
    requestedQuery: "Test Car",
    exactMatch: true,
    substituteName: null,
    name: "Test Car",
    brand: "Test",
    modelYear: na,
    bodyType: na,
    country: na,
    engine: na,
    engineCapacity: na,
    horsepower: na,
    torque: na,
    topSpeed: na,
    zeroToHundred: na,
    transmission: na,
    drivetrain: na,
    fuelType: na,
    length: na,
    width: na,
    height: na,
    wheelbase: na,
    groundClearance: na,
    kerbWeight: na,
    seatingCapacity: na,
    bootSpace: na,
    fuelTankOrBattery: na,
    wheelSize: na,
    fuelEconomyOrRange: na,
    safety: na,
    priceRange: na,
    summary: na,
    bestUseCase: na,
    pros: [],
    cons: [],
    targetBuyers: na,
    competitors: [],
    buyingAdvice: na,
    ...overrides,
  };
}

describe("classifyFuel", () => {
  test("maps verified fuel strings to cost categories", () => {
    expect(classifyFuel("Petrol")).toBe("petrol");
    expect(classifyFuel("Diesel")).toBe("diesel");
    expect(classifyFuel("CNG")).toBe("cng");
    expect(classifyFuel("Petrol + CNG")).toBe("cng");
    expect(classifyFuel("Electric")).toBe("electric");
    expect(classifyFuel("Strong Hybrid (Petrol)")).toBe("hybrid");
    expect(classifyFuel("Not Available")).toBe("petrol");
    expect(classifyFuel(undefined)).toBe("petrol");
  });
});

describe("prefillFromSpec — only verified values are used", () => {
  test("parses an India price range into a lakh midpoint", () => {
    const a = prefillFromSpec(spec({ priceRange: "Rs 8.1 - 12.5 lakh" }));
    expect(a.purchasePriceLakh).toBe(10.3);
  });

  test("leaves price at 0 when the spec has no verified India price", () => {
    const a = prefillFromSpec(spec({ priceRange: "$25,000" }));
    expect(a.purchasePriceLakh).toBe(0);
  });

  test("prefills km/l efficiency for petrol/diesel/CNG", () => {
    const a = prefillFromSpec(spec({ fuelType: "CNG", fuelEconomyOrRange: "35 km/kg" }));
    expect(a.fuelCategory).toBe("cng");
    expect(a.efficiency).toBe(35);
  });

  test("derives EV km/kWh only when battery capacity is verified", () => {
    const withBattery = prefillFromSpec(
      spec({ fuelType: "Electric", fuelEconomyOrRange: "400 km", fuelTankOrBattery: "50 kWh battery" }),
    );
    expect(withBattery.fuelCategory).toBe("electric");
    expect(withBattery.efficiency).toBe(8);

    const noBattery = prefillFromSpec(
      spec({ fuelType: "Electric", fuelEconomyOrRange: "400 km" }),
    );
    expect(noBattery.efficiency).toBe(0);
  });
});

describe("calculateOwnership", () => {
  const base: CarAssumptions = {
    ...defaultAssumptions(),
    purchasePriceLakh: 10,
    annualKm: 12000,
    fuelPrice: 100,
    efficiency: 15,
    resalePercent: 50,
    loan: { downPaymentLakh: 2, interestRatePct: 10, years: 3 },
  };

  test("counts the purchase price once — down payment and loan principal never added", () => {
    const r = calculateOwnership({ ...base, registrationCost: 0, annualMaintenance: 0, annualInsurance: 0 }, 5);
    // loan principal = 10L + 0 − 2L = 8L; interest (flat) = 8L × 10% × min(3,5) = 2.4L
    expect(r.loanAmount).toBe(800000);
    expect(r.loanInterest).toBe(240000);
    expect(r.purchase).toBe(1000000);
    // total = purchase 10L + fuel + interest 2.4L (no down payment, no principal again)
    expect(r.totalExpenditure).toBe(1000000 + r.fuel + 240000);
  });

  test("fuel cost uses annual km ÷ efficiency × price × years", () => {
    const r = calculateOwnership({ ...base, annualMaintenance: 0, annualInsurance: 0 }, 3);
    expect(r.fuel).toBe((12000 / 15) * 100 * 3);
  });

  test("EV energy cost uses km/kWh and ₹/kWh", () => {
    const ev: CarAssumptions = {
      ...defaultAssumptions("electric"),
      purchasePriceLakh: 15,
      annualKm: 10000,
      fuelPrice: 10,
      efficiency: 6,
    };
    const r = calculateOwnership(ev, 1);
    expect(r.fuel).toBeCloseTo((10000 / 6) * 10, 6);
  });

  test("missing efficiency is handled safely: fuel cost is 0, not invented", () => {
    const r = calculateOwnership({ ...base, efficiency: 0 }, 5);
    expect(r.fuel).toBe(0);
  });

  test("resale, depreciation and net cost relationships hold", () => {
    const r = calculateOwnership({ ...base, annualMaintenance: 0, annualInsurance: 0 }, 5);
    expect(r.resale).toBe(500000);
    expect(r.depreciation).toBe(500000);
    expect(r.netCost).toBe(r.totalExpenditure - r.resale);
    expect(r.monthly).toBe(r.totalExpenditure / 60);
    expect(r.netMonthly).toBe(r.netCost / 60);
  });

  test("loan interest is capped at the ownership period", () => {
    const r = calculateOwnership(
      { ...base, loan: { downPaymentLakh: 0, interestRatePct: 10, years: 7 } },
      5,
    );
    expect(r.loanAppliedYears).toBe(5);
    expect(r.loanInterest).toBe(1000000 * 0.1 * 5);
  });

  test("recurring costs scale with the ownership period", () => {
    const r3 = calculateOwnership({ ...base, loan: { ...base.loan, interestRatePct: 0 } }, 3);
    const r10 = calculateOwnership({ ...base, loan: { ...base.loan, interestRatePct: 0 } }, 10);
    expect(r3.fuel).toBe((12000 / 15) * 100 * 3);
    expect(r10.fuel).toBe((12000 / 15) * 100 * 10);
    expect(r3.totalExpenditure).toBeLessThan(r10.totalExpenditure);
  });
});

describe("formatting", () => {
  test("formatInr uses lakh for large values and rupees for small ones", () => {
    expect(formatInr(1050000)).toBe("₹10.5 lakh");
    expect(formatInr(8333)).toBe("₹8,333");
  });

  test("formatUsd converts with the given rate and is blank for invalid rates", () => {
    expect(formatUsd(840000, 84)).toBe("≈ $10,000");
    expect(formatUsd(840000, 0)).toBe("");
  });
});
