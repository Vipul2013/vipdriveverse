import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateRanking, type RankedCar } from "./rankings.server";
import { getCategory, getFilter } from "./rankings-data";

export type { RankedCar };

export const fetchRanking = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ category: z.string().min(1), filter: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ cars: RankedCar[] }> => {
    const category = getCategory(data.category);
    const filter = getFilter(data.filter);
    const cars = await generateRanking({
      categoryTitle: category.title,
      metricLabel: category.metricLabel,
      criteria: category.criteria,
      filterLabel: filter.label,
      filterCriteria: filter.criteria,
      limit: 10,
    });
    return { cars };
  });
