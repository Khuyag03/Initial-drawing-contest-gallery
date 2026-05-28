"use client";

import type { VoteIdentity } from "@/types";

const LOCAL_DEVICE_KEY = "children_day_vote_device_id";
const VOTE_STATUS_KEY = "children_day_vote_complete";
const VOTE_DRAWING_KEY = "children_day_vote_drawing_id";
const COOKIE_DEVICE_KEY = "contest_device_id";
const VOTE_STATUS_EVENT = "children_day_vote_status";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getCookie(name: string) {
  const cookies = document.cookie.split(";").map((item) => item.trim());
  const match = cookies.find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function browserFingerprintHash() {
  const source = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen.width,
    screen.height,
    screen.colorDepth,
    window.devicePixelRatio,
    navigator.hardwareConcurrency || "unknown",
    "deviceMemory" in navigator ? String(navigator.deviceMemory) : "unknown",
    navigator.maxTouchPoints || 0
  ].join("|");

  return sha256(source);
}

export async function getVoteIdentity(): Promise<VoteIdentity> {
  let localDeviceId = localStorage.getItem(LOCAL_DEVICE_KEY);
  if (!localDeviceId) {
    localDeviceId = randomId();
    localStorage.setItem(LOCAL_DEVICE_KEY, localDeviceId);
  }

  let cookieDeviceId = getCookie(COOKIE_DEVICE_KEY);
  if (!cookieDeviceId) {
    cookieDeviceId = localDeviceId;
    setCookie(COOKIE_DEVICE_KEY, cookieDeviceId);
  }

  return {
    localDeviceId,
    cookieDeviceId,
    fingerprintHash: await browserFingerprintHash()
  };
}

export function hasLocalVote() {
  if (typeof window === "undefined") {
    return false;
  }

  return localStorage.getItem(VOTE_STATUS_KEY) === "true";
}

export function markLocalVote(drawingId: string) {
  localStorage.setItem(VOTE_STATUS_KEY, "true");
  localStorage.setItem(VOTE_DRAWING_KEY, drawingId);
  window.dispatchEvent(new Event(VOTE_STATUS_EVENT));
}

export function subscribeToLocalVote(callback: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  window.addEventListener("storage", callback);
  window.addEventListener(VOTE_STATUS_EVENT, callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(VOTE_STATUS_EVENT, callback);
  };
}
