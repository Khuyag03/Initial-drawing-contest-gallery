import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hmacHash, safeEqual } from "@/lib/hash";

const ADMIN_COOKIE = "contest_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function getAdminPassword() {
  return process.env.ADMIN_PASSWORD || "";
}

function signSession(expiresAt: number) {
  return hmacHash(`${expiresAt}:${getAdminPassword()}`, "admin-session");
}

export function isAdminConfigured() {
  return getAdminPassword().length > 0;
}

export function verifyAdminSessionToken(token?: string) {
  if (!token || !isAdminConfigured()) {
    return false;
  }

  const [expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);

  if (!expiresAt || !signature || expiresAt < Date.now()) {
    return false;
  }

  return safeEqual(signSession(expiresAt), signature);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function requireAdmin() {
  if (!(await isAdminAuthenticated())) {
    redirect("/admin/login");
  }
}

export async function createAdminSession() {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const token = `${expiresAt}.${signSession(expiresAt)}`;
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE);
}
