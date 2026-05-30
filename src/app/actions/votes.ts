"use server";

import { cookies, headers } from "next/headers";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { getEmployeeSessionId } from "@/lib/employee-auth";
import { hmacHash } from "@/lib/hash";
import { isRateLimited } from "@/lib/rate-limit";
import { createServiceSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase";
import { isUuid, normalizeIdentityPart } from "@/lib/validators";
import type { VoteIdentity, VoteResult } from "@/types";

const DEVICE_COOKIE = "contest_device_id";
const SUCCESS_MESSAGE = "Таны санал амжилттай бүртгэгдлээ.";
const ALREADY_VOTED_CATEGORY_MESSAGE = "Та энэ насны ангилалд аль хэдийн санал өгсөн байна.";
const INACTIVE_EMPLOYEE_MESSAGE = "Таны санал өгөх эрх идэвхгүй байна.";

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
  const employeeId = await getEmployeeSessionId();

  if (!employeeId) {
    return voteError("Санал өгөхийн тулд SAP дугаараар нэвтэрнэ үү.");
  }

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
  const deviceHash = canonicalDeviceId ? hmacHash(canonicalDeviceId, "vote-device") : null;

  if (isRateLimited(deviceHash || employeeId, 6, 60_000)) {
    return voteError("Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.");
  }

  const supabase = createServiceSupabaseClient();
  const [
    { data: drawing, error: drawingError },
    { data: employee, error: employeeError }
  ] = await Promise.all([
    supabase
      .from("drawings")
      .select("id,age_category")
      .eq("id", drawingId)
      .maybeSingle(),
    supabase
      .from("employees")
      .select("id,sap_code,first_name,last_name,status")
      .eq("id", employeeId)
      .maybeSingle()
  ]);

  if (drawingError || !drawing) {
    return voteError("Зураг олдсонгүй.");
  }

  if (employeeError || !employee) {
    return voteError("SAP эрх олдсонгүй. Дахин нэвтэрнэ үү.");
  }

  if (employee.status !== "active") {
    return { status: "error", message: INACTIVE_EMPLOYEE_MESSAGE };
  }

  const { data: existingVote, error: existingVoteError } = await supabase
    .from("votes")
    .select("id")
    .eq("employee_id", employee.id)
    .eq("age_category", drawing.age_category)
    .is("deleted_at", null)
    .maybeSingle();

  if (existingVoteError) {
    console.error("Vote lookup failed", existingVoteError);
    return voteError();
  }

  if (existingVote) {
    return {
      status: "already_voted_category",
      message: ALREADY_VOTED_CATEGORY_MESSAGE,
      ageCategory: drawing.age_category
    };
  }

  const { error } = await supabase.from("votes").insert({
    drawing_id: drawingId,
    employee_id: employee.id,
    sap_code: employee.sap_code,
    employee_first_name: employee.first_name,
    employee_last_name: employee.last_name,
    age_category: drawing.age_category,
    device_hash: deviceHash,
    ip_hash: ipHash,
    user_agent_hash: userAgentHash,
    browser_summary: normalizeIdentityPart(identity.browserSummary)
  });

  if (error) {
    if (error.code === "23505") {
      return {
        status: "already_voted_category",
        message: ALREADY_VOTED_CATEGORY_MESSAGE,
        ageCategory: drawing.age_category
      };
    }

    console.error("Vote insert failed", error);
    return voteError();
  }

  const { count, error: countError } = await supabase
    .from("votes")
    .select("id", { count: "exact", head: true })
    .eq("drawing_id", drawingId)
    .is("deleted_at", null);

  if (countError) {
    console.error("Vote count refresh failed", countError);
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/votes");
  return {
    status: "success",
    message: SUCCESS_MESSAGE,
    ageCategory: drawing.age_category,
    voteCount: count ?? undefined
  };
}
