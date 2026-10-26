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
