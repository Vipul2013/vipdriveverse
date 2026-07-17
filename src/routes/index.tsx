import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Zap, GitCompare, Sparkles, ArrowRight } from "lucide-react";
import { TOP_BRANDS } from "@/lib/brands-data";
import { AiAssistant } from "@/components/AiAssistant";

export const Route = createFileRoute("/")({
  component: Home,
});

const FEATURED_CARS = [
  { name: "Toyota Fortuner", tag: "SUV" },
  { name: "Lamborghini Revuelto", tag: "Hypercar" },
  { name: "Tata Nexon EV", tag: "Electric" },
  { name: "BMW M5", tag: "Performance" },
  { name: "Mahindra Thar", tag: "Off-road" },
  { name: "Porsche 911", tag: "Sports" },
];

const TRENDING = [
  ["Toyota Fortuner", "Mahindra Scorpio N"],
  ["Hyundai Creta", "Kia Seltos"],
  ["Tata Nexon EV", "MG ZS EV"],
];

function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const go = (name: string) => {
    if (!name.trim()) return;
    navigate({ to: "/car/$name", params: { name: encodeURIComponent(name.trim()) } });
  };

  return (
    <div>
      {/* Hero */}
      <section className="hero-bg relative overflow-hidden">
        <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium mb-8">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            Powered by Google Gemini AI
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-[1.05]">
            Every car in the world.<br />
            <span className="gradient-text">Explained by AI.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
            Search any vehicle — from a Maruti Alto to a Bugatti Chiron — and get instant
            AI-powered specifications, analysis, and side-by-side comparisons.
          </p>

          {/* Search */}
          <form
            onSubmit={(e) => { e.preventDefault(); go(q); }}
            className="mt-10 mx-auto max-w-2xl"
          >
            <div className="glass-strong rounded-2xl p-2 flex items-center gap-2 glow">
              <Search className="h-5 w-5 text-muted-foreground ml-3" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search any car... e.g. Toyota Fortuner, BMW M5, Tata Nano"
                className="flex-1 bg-transparent outline-none px-2 py-3 text-base placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-primary to-accent px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition inline-flex items-center gap-2"
              >
                <Zap className="h-4 w-4" /> Search
              </button>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
              {["Toyota Fortuner", "Porsche 911", "Hyundai Creta", "Lamborghini Revuelto"].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => go(s)}
                  className="rounded-full glass px-3 py-1.5 hover:border-primary/50 transition"
                >{s}</button>
              ))}
            </div>
          </form>
        </div>
      </section>

      {/* Featured cars */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-3xl font-bold">Featured Cars</h2>
          <span className="text-xs text-muted-foreground">Click any card for AI-generated specs</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {FEATURED_CARS.map((c) => (
            <button
              key={c.name}
              onClick={() => go(c.name)}
              className="group glass rounded-2xl p-5 text-left hover:border-primary/50 transition hover:-translate-y-1"
            >
              <div className="h-24 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 mb-3 flex items-center justify-center">
                <span className="text-3xl">🚗</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-accent mb-1">{c.tag}</div>
              <div className="font-semibold text-sm leading-tight">{c.name}</div>
              <ArrowRight className="h-3.5 w-3.5 mt-2 opacity-0 group-hover:opacity-100 text-primary transition" />
            </button>
          ))}
        </div>
      </section>

      {/* Popular brands */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <h2 className="text-3xl font-bold">Popular Brands</h2>
          <Link
            to="/brands"
            className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-sm font-medium hover:border-primary/50 hover:text-primary transition"
          >
            View All Brands <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-3">
          {TOP_BRANDS.map((b) => (
            <Link
              key={b}
              to="/brand/$name"
              params={{ name: encodeURIComponent(b) }}
              className="glass rounded-xl px-4 py-5 text-center text-sm font-medium hover:border-primary/50 hover:text-primary transition"
            >
              {b}
            </Link>
          ))}
        </div>
      </section>

      {/* Trending comparisons */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <h2 className="text-3xl font-bold">Trending Comparisons</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TRENDING.map((pair) => (
            <button
              key={pair.join("-")}
              onClick={() =>
                navigate({
                  to: "/compare",
                  search: { cars: pair.join(",") },
                })
              }
              className="glass rounded-2xl p-6 text-left hover:border-primary/50 transition group"
            >
              <GitCompare className="h-5 w-5 text-primary mb-3" />
              <div className="text-lg font-semibold">
                {pair[0]}
                <span className="text-muted-foreground mx-2">vs</span>
                {pair[1]}
              </div>
              <div className="mt-3 text-xs text-accent flex items-center gap-1">
                Compare with AI <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* AI CTA */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <div className="glass-strong rounded-3xl p-10 sm:p-16 text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-30 pointer-events-none"
               style={{ background: "radial-gradient(circle at 50% 0%, oklch(0.68 0.19 250 / 40%), transparent 60%)" }} />
          <Sparkles className="h-10 w-10 mx-auto text-accent mb-4 relative" />
          <h2 className="text-3xl sm:text-4xl font-bold relative">
            Ask AI about <span className="gradient-text">any car</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto relative">
            Get a beginner-friendly explanation of what a car is, who it's for, and whether it's the right buy for you.
          </p>
          <button
            onClick={() => go("Toyota Innova Crysta")}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition relative"
          >
            Try a sample <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </section>
    </div>
  );
}
