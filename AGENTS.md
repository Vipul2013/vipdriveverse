<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Engine & Fuel Options
- Engine/powertrain options live in `public.car_engine_options`, keyed by the stable car id from `src/lib/car-id.ts` plus market and model year; `fetchEngineOptions` (src/lib/engine.functions.ts) serves cached rows first and otherwise generates strictly evidence-based options via Gemini, caching the result. Why: one verified powertrain list per car, shared by the car page selector and same-car option comparison.
- Optional `fuel` search param on /car/$name (set by homepage fuel filter chips) makes fetchCarSpecs return not-found when the exact car has no factory variant with that powertrain. Why: fuel filters must narrow to the exact car, never swap models.

## Smart Car Finder
- Smart Car Finder (`src/lib/finder.*`, route `/finder`) is two-stage: Gemini only proposes candidate cars matching the user's hard filters, then the deterministic layer in `finder-scoring.ts` parses verbatim spec strings, excludes cars with unverifiable India prices or data missing for a chosen priority, and ranks matches with weighted real metrics plus AI 0-10 comfort/luxury/reliability ratings. Why: recommendations must stay transparent and never invent data.
- Finder result actions reuse existing identities: View Car links use the exact car name (`/car/$name`), Compare uses stable car ids from `src/lib/car-id.ts` via `/compare?cars=<id,id>`. Scoring rules are covered by `src/lib/finder-scoring.test.ts` (run with `bun test`).
