import { describe, expect, test } from "bun:test";
import {
  parsePriceLakh,
  parseAccelSec,
  parseEfficiency,
  parseSafetyStars,
  scoreFinderCandidates,
} from "./finder-scoring";
import type { FinderCandidate, FinderPreferences } from "./finder-data";

const prefs = (over: Partial<FinderPreferences> = {}): FinderPreferences => ({
  budgetMinLakh: 5,
  budgetMaxLakh: 20,
  bodyType: "suv",
  fuelType: "",
  priorities: ["efficiency", "performance"],
  usage: "mixed",
  ...over,
});

const car = (over: Partial<FinderCandidate>): FinderCandidate => ({
  name: "Test Car",
  brand: "Test",
  modelYear: "2024",
  bodyType: "Compact SUV",
  country: "India",
  fuelType: "Petrol",
  priceRange: "Rs 10 - 12 lakh",
  horsepower: "115 bhp",
  torque: "150 Nm",
  zeroToHundred: "11 s",
  fuelEconomyOrRange: "18 km/l",
  seatingCapacity: "5",
  safety: "4-star (Bharat NCAP)",
  comfortRating: 7,
  luxuryRating: 6,
  reliabilityRating: 8,
  highlight: "A test car",
  ...over,
});

describe("parsePriceLakh", () => {
  test("lakh range", () => {
    expect(parsePriceLakh("Rs 7.5 - 8.9 lakh")).toEqual({ min: 7.5, max: 8.9 });
  });
  test("crore range", () => {
    expect(parsePriceLakh("Rs 2.1 - 4.2 crore")).toEqual({ min: 210, max: 420 });
  });
  test("absolute rupees", () => {
    expect(parsePriceLakh("₹ 8,90,000")).toEqual({ min: 8.9, max: 8.9 });
  });
  test("model year ignored", () => {
    expect(parsePriceLakh("2024 model, Rs 8.5 lakh")).toEqual({ min: 8.5, max: 8.5 });
  });
  test("non-INR price is unverified", () => {
    expect(parsePriceLakh("$30,000")).toBeNull();
  });
  test("Not Available is unverified", () => {
    expect(parsePriceLakh("Not Available")).toBeNull();
  });
});

describe("spec parsers", () => {
  test("accel", () => {
    expect(parseAccelSec("0-100 in 6.2 seconds")).toBeCloseTo(6.2);
    expect(parseAccelSec("9.5 s")).toBeCloseTo(9.5);
    expect(parseAccelSec("Not Available")).toBeNull();
  });
  test("efficiency", () => {
    expect(parseEfficiency("20.5 km/l")).toEqual({ value: 20.5, ev: false });
    expect(parseEfficiency("26 km/kg")).toEqual({ value: 26, ev: false });
    expect(parseEfficiency("400 km range")).toEqual({ value: 400, ev: true });
  });
  test("safety stars", () => {
    expect(parseSafetyStars("5-star (Global NCAP)")).toBe(5);
    expect(parseSafetyStars("4 star")).toBe(4);
    expect(parseSafetyStars("Not Available")).toBeNull();
  });
});

describe("scoreFinderCandidates", () => {
  test("unverifiable price is excluded when budget filter is set", () => {
    const r = scoreFinderCandidates(
      [car({ name: "No Price Car", priceRange: "Not Available" })],
      prefs(),
    );
    expect(r.matches).toHaveLength(0);
    expect(r.excluded[0].reason).toContain("Price could not be verified");
  });

  test("car outside budget is excluded", () => {
    const r = scoreFinderCandidates(
      [car({ name: "Rich Car", priceRange: "Rs 30 - 35 lakh" })],
      prefs(),
    );
    expect(r.matches).toHaveLength(0);
    expect(r.excluded[0].reason).toContain("Above your budget");
  });

  test("wrong fuel is excluded", () => {
    const r = scoreFinderCandidates(
      [car({ name: "EV Car", fuelType: "Electric (EV)", fuelEconomyOrRange: "400 km range" })],
      prefs({ fuelType: "petrol" }),
    );
    expect(r.matches).toHaveLength(0);
    expect(r.excluded[0].reason).toContain("Not a Petrol");
  });

  test("missing horsepower excluded when performance is a priority", () => {
    const r = scoreFinderCandidates(
      [car({ name: "Mystery Car", horsepower: "Not Available" })],
      prefs({ priorities: ["performance"] }),
    );
    expect(r.matches).toHaveLength(0);
    expect(r.excluded[0].reason).toContain("Horsepower data unavailable");
  });

  test("matching car ranks with parsed specs and budget explanation", () => {
    const r = scoreFinderCandidates([car({ name: "Good Car" })], prefs());
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0].id).toBe("good-car");
    expect(r.matches[0].rank).toBe(1);
    expect(r.matches[0].why[0]).toContain("₹5–20 lakh budget");
  });

  test("usage nudge: efficient car wins under city use, tie otherwise", () => {
    // No torque/accel data → performance is driven purely by horsepower,
    // so the two cars mirror each other exactly (hp vs efficiency).
    const a = car({
      name: "Fast Car",
      horsepower: "200 bhp",
      fuelEconomyOrRange: "12 km/l",
      torque: "Not Available",
      zeroToHundred: "Not Available",
    });
    const b = car({
      name: "Frugal Car",
      horsepower: "100 bhp",
      fuelEconomyOrRange: "25 km/l",
      torque: "Not Available",
      zeroToHundred: "Not Available",
    });
    const mixed = scoreFinderCandidates([a, b], prefs());
    const city = scoreFinderCandidates([a, b], prefs({ usage: "city" }));
    const fastMixed = mixed.matches.find((m) => m.name === "Fast Car")!.matchScore;
    const frugalMixed = mixed.matches.find((m) => m.name === "Frugal Car")!.matchScore;
    const frugalCity = city.matches.find((m) => m.name === "Frugal Car")!.matchScore;
    const fastCity = city.matches.find((m) => m.name === "Fast Car")!.matchScore;
    expect(fastMixed).toBe(frugalMixed); // equal weights → equal blended scores
    expect(frugalCity).toBeGreaterThan(fastCity); // city doubles efficiency weight
  });

  test("duplicate models collapse to one identity", () => {
    const r = scoreFinderCandidates(
      [car({ name: "Same Car" }), car({ name: "Same Car ", priceRange: "Rs 11 - 13 lakh" })],
      prefs(),
    );
    expect(r.checkedCount).toBe(1);
  });
});
