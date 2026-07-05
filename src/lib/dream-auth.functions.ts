import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be under 24 characters")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, . _ - allowed");

const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

export const registerDreamUser = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; pin: string; confirmPin: string }) => {
    const parsed = z
      .object({ username: usernameSchema, pin: pinSchema, confirmPin: pinSchema })
      .parse(data);
    if (parsed.pin !== parsed.confirmPin) throw new Error("PINs do not match");
    return parsed;
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSession, hashPin, newSalt } = await import("./dream-auth.server");
    const usernameLower = data.username.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("dream_users")
      .select("id")
      .eq("username_lower", usernameLower)
      .maybeSingle();
    if (existing) throw new Error("Username already taken. Choose another.");

    const salt = newSalt();
    const pin_hash = await hashPin(data.pin, salt);

    const { data: created, error } = await supabaseAdmin
      .from("dream_users")
      .insert({
        username: data.username,
        username_lower: usernameLower,
        pin_hash,
        pin_salt: salt,
      })
      .select("id, username")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Could not create account");

    const session = await getSession();
    await session.update({ userId: created.id, username: created.username });
    return { username: created.username };
  });

export const loginDreamUser = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; pin: string }) =>
    z.object({ username: usernameSchema, pin: pinSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getSession, hashPin, safeEqualHex } = await import("./dream-auth.server");
    const usernameLower = data.username.toLowerCase();

    const { data: user } = await supabaseAdmin
      .from("dream_users")
      .select("id, username, pin_hash, pin_salt")
      .eq("username_lower", usernameLower)
      .maybeSingle();

    if (!user) throw new Error("Incorrect PIN. Please try again.");
    const attempt = await hashPin(data.pin, user.pin_salt);
    if (!safeEqualHex(attempt, user.pin_hash)) {
      throw new Error("Incorrect PIN. Please try again.");
    }

    const session = await getSession();
    await session.update({ userId: user.id, username: user.username });
    return { username: user.username };
  });

export const logoutDreamUser = createServerFn({ method: "POST" }).handler(async () => {
  const { getSession } = await import("./dream-auth.server");
  const session = await getSession();
  await session.clear();
  return { ok: true };
});

export const getDreamUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSession } = await import("./dream-auth.server");
  const session = await getSession();
  if (!session.data.userId) return { user: null as null | { username: string } };
  return { user: { username: session.data.username ?? "" } };
});
