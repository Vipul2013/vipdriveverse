import { useSession } from "@tanstack/react-start/server";
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export type SessionData = { userId?: string; username?: string };

export function sessionConfig() {
  const password = process.env.DREAM_SESSION_SECRET;
  if (!password) throw new Error("DREAM_SESSION_SECRET not configured");
  return {
    password,
    name: "carverse_dream_session",
    maxAge: 60 * 60 * 24 * 30,
    cookie: { httpOnly: true, sameSite: "lax" as const, secure: true, path: "/" },
  };
}

export async function getSession() {
  return useSession<SessionData>(sessionConfig());
}

export async function hashPin(pin: string, salt: string) {
  const buf = await scrypt(pin, salt, 64);
  return buf.toString("hex");
}

export function newSalt() {
  return randomBytes(16).toString("hex");
}

export function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function requireUserId() {
  const session = await getSession();
  if (!session.data.userId || !session.data.username) throw new Error("Not signed in");
  return { userId: session.data.userId, username: session.data.username };
}
