import "server-only";

import { cookies } from "next/headers";
import { hmacHash, safeEqual } from "@/lib/hash";

export const EMPLOYEE_COOKIE = "contest_employee_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24;

function signEmployeeSession(employeeId: string, expiresAt: number) {
  return hmacHash(`${employeeId}:${expiresAt}`, "employee-session");
}

export function normalizeSapCode(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return String(value).trim().replace(/\s+/g, "").slice(0, 64);
}

export function createEmployeeSessionToken(employeeId: string) {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const signature = signEmployeeSession(employeeId, expiresAt);
  return `${employeeId}.${expiresAt}.${signature}`;
}

export function verifyEmployeeSessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [employeeId, expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number(expiresAtRaw);

  if (!employeeId || !expiresAt || !signature || expiresAt < Date.now()) {
    return null;
  }

  if (!safeEqual(signEmployeeSession(employeeId, expiresAt), signature)) {
    return null;
  }

  return employeeId;
}

export async function setEmployeeSession(employeeId: string) {
  const cookieStore = await cookies();
  cookieStore.set(EMPLOYEE_COOKIE, createEmployeeSessionToken(employeeId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS
  });
}

export async function getEmployeeSessionId() {
  const cookieStore = await cookies();
  return verifyEmployeeSessionToken(cookieStore.get(EMPLOYEE_COOKIE)?.value);
}

export async function clearEmployeeSession() {
  const cookieStore = await cookies();
  cookieStore.delete(EMPLOYEE_COOKIE);
}
