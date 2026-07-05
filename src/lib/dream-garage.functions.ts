import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const carInputSchema = z.object({
  carQuery: z.string().trim().min(1).max(200),
  carName: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(100).optional().nullable(),
  modelYear: z.string().trim().max(20).optional().nullable(),
  bodyType: z.string().trim().max(80).optional().nullable(),
  fuelType: z.string().trim().max(80).optional().nullable(),
  imageUrl: z.string().trim().max(2000).optional().nullable(),
  summary: z.string().trim().max(4000).optional().nullable(),
});

export const addToDreamGarage = createServerFn({ method: "POST" })
  .inputValidator((data: z.input<typeof carInputSchema>) => carInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireUserId } = await import("./dream-auth.server");
    const { userId } = await requireUserId();

    const { data: existing } = await supabaseAdmin
      .from("dream_garage_cars")
      .select("id")
      .eq("user_id", userId)
      .eq("car_query", data.carQuery)
      .maybeSingle();

    if (existing) return { status: "exists" as const };

    const { error } = await supabaseAdmin.from("dream_garage_cars").insert({
      user_id: userId,
      car_query: data.carQuery,
      car_name: data.carName,
      brand: data.brand ?? null,
      model_year: data.modelYear ?? null,
      body_type: data.bodyType ?? null,
      fuel_type: data.fuelType ?? null,
      image_url: data.imageUrl ?? null,
      summary: data.summary ?? null,
    });
    if (error) throw new Error(error.message);
    return { status: "added" as const };
  });

export const removeFromDreamGarage = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requireUserId } = await import("./dream-auth.server");
    const { userId } = await requireUserId();

    const { error } = await supabaseAdmin
      .from("dream_garage_cars")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type DreamCar = {
  id: string;
  carQuery: string;
  carName: string;
  brand: string | null;
  modelYear: string | null;
  bodyType: string | null;
  fuelType: string | null;
  imageUrl: string | null;
  summary: string | null;
  addedAt: string;
};

export const listDreamGarage = createServerFn({ method: "GET" }).handler(async (): Promise<{
  cars: DreamCar[];
}> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requireUserId } = await import("./dream-auth.server");
  const { userId } = await requireUserId();

  const { data, error } = await supabaseAdmin
    .from("dream_garage_cars")
    .select("id, car_query, car_name, brand, model_year, body_type, fuel_type, image_url, summary, added_at")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw new Error(error.message);

  return {
    cars: (data ?? []).map((r) => ({
      id: r.id,
      carQuery: r.car_query,
      carName: r.car_name,
      brand: r.brand,
      modelYear: r.model_year,
      bodyType: r.body_type,
      fuelType: r.fuel_type,
      imageUrl: r.image_url,
      summary: r.summary,
      addedAt: r.added_at,
    })),
  };
});
