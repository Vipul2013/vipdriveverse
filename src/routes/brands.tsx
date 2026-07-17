import { createFileRoute, Link } from "@tanstack/react-router";
import { BRANDS_BY_COUNTRY } from "@/lib/brands-data";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/brands")({
  component: BrandsPage,
  head: () => ({
    meta: [
      { title: "All Car Brands by Country — VipDriveVerse" },
      { name: "description", content: "Explore all major automobile manufacturers grouped by country. AI-powered brand profiles and complete model lineups." },
    ],
  }),
});

function BrandsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-bold">
          All <span className="gradient-text">Car Brands</span>
        </h1>
        <p className="mt-3 text-muted-foreground">Every major automobile manufacturer, grouped by country of origin.</p>
      </div>

      <div className="space-y-10">
        {BRANDS_BY_COUNTRY.map(({ country, flag, brands }) => (
          <section key={country}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{flag}</span>
              <h2 className="text-2xl font-bold">{country}</h2>
              <span className="text-xs text-muted-foreground">{brands.length} brands</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {brands.map((b) => (
                <Link
                  key={b}
                  to="/brand/$name"
                  params={{ name: encodeURIComponent(b) }}
                  className="group glass rounded-xl px-4 py-5 text-center text-sm font-medium hover:border-primary/50 hover:text-primary transition inline-flex items-center justify-center gap-1.5"
                >
                  {b}
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
