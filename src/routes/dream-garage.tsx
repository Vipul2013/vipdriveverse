import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Heart,
  Trash2,
  Search,
  ArrowUpDown,
  LogOut,
  Sparkles,
  Loader2,
  UserPlus,
  LogIn as LogInIcon,
  ImageOff,
  Car,
} from "lucide-react";
import {
  getDreamUser,
  loginDreamUser,
  logoutDreamUser,
  registerDreamUser,
} from "@/lib/dream-auth.functions";
import { listDreamGarage, removeFromDreamGarage, type DreamCar } from "@/lib/dream-garage.functions";

export const Route = createFileRoute("/dream-garage")({
  component: DreamGaragePage,
  head: () => ({
    meta: [
      { title: "Dream Garage — CarVerse" },
      { name: "description", content: "Your personal collection of favorite cars, saved securely with a private username and PIN." },
    ],
  }),
});

function DreamGaragePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dream-user"],
    queryFn: () => getDreamUser(),
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.user) return <AuthGate />;
  return <Garage username={data.user.username} />;
}

/* ---------------- AUTH ---------------- */

function AuthGate() {
  const [mode, setMode] = useState<"login" | "register">("login");
  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent glow mb-4">
          <Heart className="h-7 w-7 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold">Dream Garage</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your private collection — no email, no social login. Just a username and a 4-digit PIN.
        </p>
      </div>

      <div className="glass-strong rounded-3xl p-6 sm:p-8">
        <div className="flex rounded-xl bg-white/5 p-1 mb-6">
          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <LogInIcon className="inline h-4 w-4 mr-1.5" /> Sign In
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            <UserPlus className="inline h-4 w-4 mr-1.5" /> Create Account
          </button>
        </div>
        {mode === "login" ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  );
}

function PinInput({
  value,
  onChange,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        {label}
      </label>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={4}
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="w-full rounded-xl bg-white/5 border border-border px-4 py-3 text-center text-2xl tracking-[0.6em] font-bold outline-none focus:border-primary transition"
        placeholder="••••"
      />
    </div>
  );
}

function LoginForm() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { username: string; pin: string }) => loginDreamUser({ data: v }),
    onSuccess: (r) => {
      toast.success(`Welcome back, ${r.username}`);
      qc.invalidateQueries({ queryKey: ["dream-user"] });
    },
    onError: (e: Error) => toast.error(e.message || "Sign in failed"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ username, pin });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl bg-white/5 border border-border px-4 py-3 outline-none focus:border-primary"
          placeholder="your_username"
          autoComplete="username"
        />
      </div>
      <PinInput value={pin} onChange={setPin} label="4-Digit PIN" />
      <button
        disabled={mutation.isPending}
        className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Open my Dream Garage"}
      </button>
    </form>
  );
}

function RegisterForm() {
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const mutation = useMutation({
    mutationFn: (v: { username: string; pin: string; confirmPin: string }) =>
      registerDreamUser({ data: v }),
    onSuccess: (r) => {
      toast.success(`Dream Garage created for ${r.username}`);
      qc.invalidateQueries({ queryKey: ["dream-user"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not register"),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate({ username, pin, confirmPin });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Choose a Username
        </label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-xl bg-white/5 border border-border px-4 py-3 outline-none focus:border-primary"
          placeholder="e.g. speedracer"
          autoComplete="off"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">3–24 characters. Letters, numbers, . _ -</p>
      </div>
      <PinInput value={pin} onChange={setPin} label="Create a 4-Digit PIN" />
      <PinInput value={confirmPin} onChange={setConfirmPin} label="Confirm PIN" />
      <button
        disabled={mutation.isPending}
        className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition disabled:opacity-50"
      >
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin inline" /> : "Create my Dream Garage"}
      </button>
      <p className="text-[11px] text-center text-muted-foreground">
        Your PIN is hashed and stored securely — never in plain text.
      </p>
    </form>
  );
}

/* ---------------- GARAGE ---------------- */

type Sort = "recent" | "brand" | "name";

function Garage({ username }: { username: string }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("recent");

  const { data, isLoading } = useQuery({
    queryKey: ["dream-garage"],
    queryFn: () => listDreamGarage(),
  });

  const logout = useMutation({
    mutationFn: () => logoutDreamUser(),
    onSuccess: () => {
      qc.setQueryData(["dream-user"], { user: null });
      qc.removeQueries({ queryKey: ["dream-garage"] });
      toast.success("Signed out");
    },
  });

  const cars = data?.cars ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q
      ? cars.filter(
          (c) =>
            c.carName.toLowerCase().includes(q) ||
            (c.brand ?? "").toLowerCase().includes(q),
        )
      : cars.slice();
    if (sort === "brand") list.sort((a, b) => (a.brand ?? "").localeCompare(b.brand ?? ""));
    else if (sort === "name") list.sort((a, b) => a.carName.localeCompare(b.carName));
    return list;
  }, [cars, search, sort]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <div className="text-xs font-semibold text-accent uppercase tracking-widest">
            @{username}
          </div>
          <h1 className="mt-1 text-3xl sm:text-4xl font-bold">
            Your <span className="gradient-text">Dream Garage</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cars.length} {cars.length === 1 ? "car" : "cars"} saved
          </p>
        </div>
        <button
          onClick={() => logout.mutate(undefined)}
          className="inline-flex items-center gap-2 rounded-full glass px-4 py-2 text-sm hover:border-primary/40 transition"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-16">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
        </div>
      ) : cars.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your garage..."
                className="w-full rounded-xl bg-white/5 border border-border pl-10 pr-4 py-2.5 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="relative">
              <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                className="rounded-xl bg-white/5 border border-border pl-10 pr-8 py-2.5 text-sm outline-none focus:border-primary appearance-none"
              >
                <option value="recent">Recently Added</option>
                <option value="brand">Brand (A–Z)</option>
                <option value="name">Name (A–Z)</option>
              </select>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c) => (
              <GarageCard key={c.id} car={c} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-sm text-muted-foreground">
              No cars match "{search}"
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GarageCard({ car }: { car: DreamCar }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const remove = useMutation({
    mutationFn: () => removeFromDreamGarage({ data: { id: car.id } }),
    onSuccess: () => {
      toast.success("Removed from Dream Garage");
      qc.invalidateQueries({ queryKey: ["dream-garage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="group glass rounded-2xl overflow-hidden transition hover:border-primary/50 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary/10 duration-300">
      <div className="relative h-44 bg-gradient-to-br from-primary/20 via-accent/10 to-transparent overflow-hidden">
        {car.imageUrl ? (
          <img
            src={car.imageUrl}
            alt={car.carName}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" />
            <span className="text-xs">Image Not Available</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="text-[10px] font-semibold text-accent uppercase tracking-widest">
          {car.brand ?? "—"}
        </div>
        <h3 className="mt-1 font-bold text-lg leading-tight">{car.carName}</h3>
        <div className="mt-1 text-xs text-muted-foreground">{car.modelYear ?? ""}</div>
        {car.summary && (
          <p className="mt-3 text-xs text-muted-foreground line-clamp-3">{car.summary}</p>
        )}
        <div className="mt-4 flex gap-2">
          <Link
            to="/car/$name"
            params={{ name: encodeURIComponent(car.carQuery) }}
            className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent px-3 py-2 text-xs font-semibold text-center text-primary-foreground hover:opacity-90 transition"
          >
            View Details
          </Link>
          {confirming ? (
            <>
              <button
                onClick={() => remove.mutate(undefined)}
                disabled={remove.isPending}
                className="rounded-xl bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground"
              >
                {remove.isPending ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className="rounded-xl glass px-3 py-2 text-xs"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              aria-label="Remove"
              className="rounded-xl glass px-3 py-2 text-xs hover:border-destructive/50 hover:text-destructive transition"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="glass-strong rounded-3xl p-12 text-center">
      <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-accent/20 mb-4">
        <Car className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-xl font-bold">Your Dream Garage is empty.</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Start adding your favorite cars.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2.5 text-sm font-semibold text-primary-foreground"
      >
        <Sparkles className="h-4 w-4" /> Search a car
      </Link>
    </div>
  );
}
