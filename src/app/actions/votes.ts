"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { hmacHash } from "@/lib/hash";
import { isRateLimited } from "@/lib/rate-limit";
import { createServiceSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase";
import { isUuid, normalizeIdentityPart } from "@/lib/validators";
import type { VoteIdentity, VoteResult } from "@/types";

const DEVICE_COOKIE = "contest_device_id";
const SUCCESS_MESSAGE = "Таны санал амжилттай бүртгэгдлээ";
const ALREADY_VOTED_MESSAGE = "Та аль хэдийн санал өгсөн байна";

function getRequestIp(requestHeaders: Pick<Headers, "get">) {
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || null;
  }

  return (
    requestHeaders.get("x-real-ip") ||
    requestHeaders.get("cf-connecting-ip") ||
    requestHeaders.get("x-vercel-forwarded-for") ||
    null
  );
}

function voteError(message = "Санал бүртгэхэд алдаа гарлаа. Дахин оролдоно уу."): VoteResult {
  return { status: "error", message };
}

export async function submitVote(
  drawingId: string,
  identity: VoteIdentity = {}
): Promise<VoteResult> {
  noStore();

  if (!isUuid(drawingId)) {
    return voteError("Зургийн мэдээлэл буруу байна.");
  }

  if (!hasServerSupabaseEnv()) {
    return voteError("Серверийн Supabase тохиргоо дутуу байна.");
  }

  const requestHeaders = await headers();
  const cookieStore = await cookies();
  const serverCookieDeviceId = normalizeIdentityPart(cookieStore.get(DEVICE_COOKIE)?.value);
  const localDeviceId = normalizeIdentityPart(identity.localDeviceId);
  const browserCookieDeviceId = normalizeIdentityPart(identity.cookieDeviceId);
  const fingerprintHash = normalizeIdentityPart(identity.fingerprintHash);
  const cookieDeviceId = browserCookieDeviceId || serverCookieDeviceId || localDeviceId;

  if (!serverCookieDeviceId && cookieDeviceId) {
    cookieStore.set(DEVICE_COOKIE, cookieDeviceId, {
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }

  if (!localDeviceId && !cookieDeviceId && !fingerprintHash) {
    return voteError("Төхөөрөмжийн мэдээлэл уншигдсангүй.");
  }

  const ip = getRequestIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent") || "";
  const ipHash = ip ? hmacHash(ip, "vote-ip") : null;
  const userAgentHash = userAgent ? hmacHash(userAgent, "vote-user-agent") : null;
  const canonicalDeviceId =
    cookieDeviceId ||
    localDeviceId ||
    serverCookieDeviceId ||
    fingerprintHash ||
    `${ipHash || "no-ip"}|${userAgentHash || "no-user-agent"}`;
  const deviceHash = hmacHash(canonicalDeviceId, "vote-device");

  if (isRateLimited(deviceHash, 6, 60_000)) {
    return voteError("Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.");
  }

  const supabase = createServiceSupabaseClient();
  const { data: drawing, error: drawingError } = await supabase
    .from("drawings")
    .select("id")
    .eq("id", drawingId)
    .maybeSingle();

  if (drawingError || !drawing) {
    return voteError("Зураг олдсонгүй.");
  }

  const { data: existingVote, error: existingVoteError } = await supabase
    .from("votes")
    .select("id")
    .eq("device_hash", deviceHash)
    .maybeSingle();

  if (existingVoteError) {
    console.error("Vote lookup failed", existingVoteError);
    return voteError();
  }

  if (existingVote) {
    return { status: "already_voted", message: ALREADY_VOTED_MESSAGE };
  }

  const { error } = await supabase.from("votes").insert({
    drawing_id: drawingId,
    device_hash: deviceHash,
    ip_hash: ipHash,
    user_agent_hash: userAgentHash
  });

  if (error) {
    if (error.code === "23505") {
      return { status: "already_voted", message: ALREADY_VOTED_MESSAGE };
    }

    console.error("Vote insert failed", error);
    return voteError();
  }

  revalidatePath("/");
  return { status: "success", message: SUCCESS_MESSAGE };
}
