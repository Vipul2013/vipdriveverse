import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { z } from "zod";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

type SessionData = { userId?: string; username?: string };

function sessionConfig() {
  const password = process.env.DREAM_SESSION_SECRET;
  if (!password) throw new Error("DREAM_SESSION_SECRET not configured");
  return {
    password,
    name: "carverse_dream_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/" },
  };
}

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(24, "Username must be under 24 characters")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Only letters, numbers, . _ - allowed");

const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

async function hashPin(pin: string, salt: string) {
  const buf = await scrypt(pin, salt, 64);
  return buf.toString("hex");
}

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
    const usernameLower = data.username.toLowerCase();

    const { data: existing } = await supabaseAdmin
      .from("dream_users")
      .select("id")
      .eq("username_lower", usernameLower)
      .maybeSingle();
    if (existing) throw new Error("Username already taken. Choose another.");

    const salt = randomBytes(16).toString("hex");
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

    const session = await useSession<SessionData>(sessionConfig());
    await session.update({ userId: created.id, username: created.username });
    return { username: created.username };
  });

export const loginDreamUser = createServerFn({ method: "POST" })
  .inputValidator((data: { username: string; pin: string }) =>
    z.object({ username: usernameSchema, pin: pinSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const usernameLower = data.username.toLowerCase();

    const { data: user } = await supabaseAdmin
      .from("dream_users")
      .select("id, username, pin_hash, pin_salt")
      .eq("username_lower", usernameLower)
      .maybeSingle();

    if (!user) throw new Error("Incorrect PIN. Please try again.");
    const attempt = await hashPin(data.pin, user.pin_salt);
    const a = Buffer.from(attempt, "hex");
    const b = Buffer.from(user.pin_hash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("Incorrect PIN. Please try again.");
    }

    const session = await useSession<SessionData>(sessionConfig());
    await session.update({ userId: user.id, username: user.username });
    return { username: user.username };
  });

export const logoutDreamUser = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<SessionData>(sessionConfig());
  await session.clear();
  return { ok: true };
});

export const getDreamUser = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<SessionData>(sessionConfig());
  if (!session.data.userId) return { user: null as null | { username: string } };
  return { user: { username: session.data.username ?? "" } };
});

export async function requireDreamUserId(): Promise<{ userId: string; username: string }> {
  const session = await useSession<SessionData>(sessionConfig());
  if (!session.data.userId || !session.data.username) {
    throw new Error("Not signed in");
  }
  return { userId: session.data.userId, username: session.data.username };
}
