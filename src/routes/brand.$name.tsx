import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { fetchBrandProfile } from "@/lib/brand.functions";
import { ArrowRight, Globe, MapPin, Calendar, User, Building2, Star, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/brand/$name")({
  component: BrandProfilePage,
  head: ({ params }) => {
    const name = decodeURIComponent(params.name);
    return {
      meta: [
        { title: `${name} — Brand Profile | VipDriveVerse` },
        { name: "description", content: `Complete AI-generated brand profile of ${name}: history, founders, models, ratings, and full car lineup.` },
      ],
    };
  },
});

function BrandProfilePage() {
  const { name } = Route.useParams();
  const decoded = decodeURIComponent(name);
  const fetchFn = useServerFn(fetchBrandProfile);
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["brand", decoded],
    queryFn: () => fetchFn({ data: { name: decoded } }),
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-24 text-center">
        <div className="inline-block h-10 w-10 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="mt-4 text-muted-foreground">Fetching brand information about <span className="text-foreground font-medium">{decoded}</span>…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
        <h1 className="text-2xl font-bold">Couldn't load brand profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message ?? "Unknown error"}</p>
        <button onClick={() => refetch()} className="mt-6 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Try again</button>
      </div>
    );
  }

  const meta = [
    { icon: Calendar, label: "Founded", value: data.founded },
    { icon: User, label: "Founder(s)", value: data.founders },
    { icon: MapPin, label: "Headquarters", value: data.headquarters },
    { icon: Globe, label: "Country", value: data.country },
    { icon: Building2, label: "Parent", value: data.parentCompany },
  ];

  const ratings = [
    { label: "Reliability", value: data.reliability },
    { label: "Performance", value: data.performance },
    { label: "Luxury", value: data.luxury },
    { label: "Safety", value: data.safety },
    { label: "Popularity", value: data.popularity },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Header */}
      <div className="glass-strong rounded-3xl p-8 sm:p-12 mb-8">
        <div className="flex items-start gap-6 flex-wrap">
          <div className="h-24 w-24 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 flex items-center justify-center text-4xl font-bold gradient-text">
            {data.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-[240px]">
            <div className="text-xs uppercase tracking-widest text-accent mb-1">{data.brandType}</div>
            <h1 className="text-4xl sm:text-5xl font-bold">{data.name}</h1>
            <p className="mt-3 text-muted-foreground max-w-3xl">{data.history}</p>
            {data.website !== "Not Available" && (
              <a href={data.website.startsWith("http") ? data.website : `https://${data.website}`} target="_blank" rel="noreferrer"
                 className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <Globe className="h-3.5 w-3.5" /> Official Website
              </a>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {meta.map((m) => (
            <div key={m.label} className="glass rounded-xl p-4">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><m.icon className="h-3 w-3" />{m.label}</div>
              <div className="text-sm font-semibold truncate">{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ratings */}
      <section className="mb-8">
        <h2 className="text-2xl font-bold mb-4">Ratings</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {ratings.map((r) => (
            <div key={r.label} className="glass rounded-2xl p-5 text-center">
              <Star className="h-4 w-4 mx-auto text-accent mb-2" />
              <div className="text-2xl font-bold gradient-text">{r.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{r.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Timeline */}
      {data.timeline.length > 0 && (
        <section className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Brand Timeline</h2>
          <div className="glass rounded-2xl p-6 space-y-3">
            {data.timeline.map((t, i) => (
              <div key={i} className="flex gap-4 border-b border-border/40 last:border-0 pb-3 last:pb-0">
                <div className="text-primary font-bold w-16 shrink-0">{t.year}</div>
                <div className="text-sm">{t.event}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Achievements + Facts */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {data.achievements.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-bold mb-3">Famous Achievements</h3>
            <ul className="space-y-2 text-sm">
              {data.achievements.map((a, i) => <li key={i} className="flex gap-2"><span className="text-accent">▸</span>{a}</li>)}
            </ul>
          </div>
        )}
        {data.facts.length > 0 && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-bold mb-3">Interesting Facts</h3>
            <ul className="space-y-2 text-sm">
              {data.facts.map((f, i) => <li key={i} className="flex gap-2"><span className="text-primary">✦</span>{f}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Car models by category */}
      {data.categories.length > 0 && (
        <section>
          <h2 className="text-3xl font-bold mb-2">{data.name} Cars</h2>
          <p className="text-sm text-muted-foreground mb-6">Click any model for full AI-generated specifications.</p>
          <div className="space-y-8">
            {data.categories.map((cat) => (
              <div key={cat.category}>
                <h3 className="text-xl font-semibold mb-3">{cat.category} <span className="text-xs text-muted-foreground font-normal">({cat.models.length})</span></h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {cat.models.map((m) => {
                    const full = m.toLowerCase().includes(data.name.toLowerCase()) ? m : `${data.name} ${m}`;
                    return (
                      <button
                        key={m}
                        onClick={() => navigate({ to: "/car/$name", params: { name: encodeURIComponent(full) } })}
                        className="group glass rounded-xl p-4 text-left hover:border-primary/50 transition hover:-translate-y-0.5"
                      >
                        <div className="text-sm font-semibold">{m}</div>
                        <div className="mt-2 text-xs text-accent inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          View specs <ArrowRight className="h-3 w-3" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 text-center">
        <Link to="/brands" className="text-sm text-muted-foreground hover:text-primary transition">← All Brands</Link>
      </div>
    </div>
  );
}
