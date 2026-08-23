export type RankingCategory = {
  key: string;
  emoji: string;
  title: string;
  group: "Performance" | "Categories" | "Value & Other";
  metricLabel: string;
  criteria: string;
};

export const RANKING_CATEGORIES: RankingCategory[] = [
  { key: "fastest", emoji: "⚡", title: "Fastest Cars", group: "Performance", metricLabel: "Top Speed", criteria: "Highest verified top speed." },
  { key: "acceleration", emoji: "🚀", title: "Best Acceleration", group: "Performance", metricLabel: "0-100 km/h", criteria: "Quickest 0-100 km/h time (lowest is best)." },
  { key: "power", emoji: "💪", title: "Most Powerful", group: "Performance", metricLabel: "Horsepower", criteria: "Highest peak horsepower." },
  { key: "torque", emoji: "🔧", title: "Highest Torque", group: "Performance", metricLabel: "Torque", criteria: "Highest peak torque in Nm." },
  { key: "luxury", emoji: "👑", title: "Best Luxury Cars", group: "Categories", metricLabel: "Segment", criteria: "Finest luxury saloons and limousines judged on comfort, materials and refinement." },
  { key: "suv", emoji: "🛞", title: "Best SUVs", group: "Categories", metricLabel: "Segment", criteria: "Best all-round SUVs judged on practicality, capability and value." },
  { key: "sports", emoji: "🏁", title: "Best Sports Cars", group: "Categories", metricLabel: "Segment", criteria: "Best driver-focused sports cars." },
  { key: "supercar", emoji: "🔥", title: "Best Supercars", group: "Categories", metricLabel: "Segment", criteria: "Best mid/front-engined supercars." },
  { key: "hypercar", emoji: "🚀", title: "Best Hypercars", group: "Categories", metricLabel: "Segment", criteria: "Best hypercars — extreme performance flagships." },
  { key: "ev", emoji: "🔋", title: "Best EVs", group: "Categories", metricLabel: "Range", criteria: "Best fully electric cars judged on range, charging and usability." },
  { key: "value", emoji: "💰", title: "Best Value for Money", group: "Value & Other", metricLabel: "Price", criteria: "Best value: features and capability relative to price." },
  { key: "mileage", emoji: "⛽", title: "Best Mileage / Efficiency", group: "Value & Other", metricLabel: "Efficiency", criteria: "Best real-world fuel economy or energy efficiency." },
  { key: "expensive", emoji: "💵", title: "Most Expensive Cars", group: "Value & Other", metricLabel: "Price", criteria: "Highest list price." },
  { key: "indian", emoji: "🇮🇳", title: "Best Indian Cars", group: "Value & Other", metricLabel: "Segment", criteria: "Best cars from Indian manufacturers (Tata, Mahindra, Maruti Suzuki, etc.)." },
  { key: "overall", emoji: "🏆", title: "Best Overall Cars", group: "Value & Other", metricLabel: "Overall", criteria: "Best all-round cars considering performance, quality, practicality and value." },
];

export type RankingFilter = { key: string; label: string; criteria: string };

export const RANKING_FILTERS: RankingFilter[] = [
  { key: "all", label: "All Cars", criteria: "Any production car worldwide." },
  { key: "indian", label: "Indian Cars", criteria: "Only cars sold in India (including Indian brands and models on sale in India)." },
  { key: "global", label: "Global Cars", criteria: "International models, excluding India-only models." },
  { key: "suv", label: "SUVs", criteria: "Only SUVs and crossovers." },
  { key: "ev", label: "EVs", criteria: "Only fully electric vehicles." },
  { key: "luxury", label: "Luxury", criteria: "Only luxury-brand vehicles." },
  { key: "sports", label: "Sports", criteria: "Only sports cars." },
  { key: "supercar", label: "Supercars", criteria: "Only supercars." },
  { key: "hypercar", label: "Hypercars", criteria: "Only hypercars." },
];

export function getCategory(key: string): RankingCategory {
  return RANKING_CATEGORIES.find((c) => c.key === key) ?? RANKING_CATEGORIES[0];
}

export function getFilter(key: string): RankingFilter {
  return RANKING_FILTERS.find((f) => f.key === key) ?? RANKING_FILTERS[0];
}
