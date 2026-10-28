import { createServerFn } from "@tanstack/react-start";
import { generateFinderCandidates } from "./finder.server";
import { scoreFinderCandidates, type FinderResult } from "./finder-scoring";
import { FinderPreferencesSchema } from "./finder-data";

export type { FinderResult };

/**
 * Smart Car Finder: AI proposes candidates for the user's hard filters, then a
 * deterministic layer verifies prices/specs, excludes cars with missing data
 * and ranks matches transparently.
 */
export const findCars = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FinderPreferencesSchema.parse(input))
  .handler(async ({ data }): Promise<FinderResult> => {
    const candidates = await generateFinderCandidates(data);
    return scoreFinderCandidates(candidates, data);
  });
