import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

function getHashSecret() {
  return (
    process.env.VOTE_HASH_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ADMIN_PASSWORD ||
    "development-only-contest-secret"
  );
}

export function hmacHash(value: string, purpose: string) {
  return createHmac("sha256", getHashSecret())
    .update(purpose)
    .update(":")
    .update(value)
    .digest("hex");
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
