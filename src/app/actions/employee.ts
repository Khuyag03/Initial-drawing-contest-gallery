"use server";

import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { clearEmployeeSession, getEmployeeSessionId, normalizeSapCode, setEmployeeSession } from "@/lib/employee-auth";
import { createServiceSupabaseClient, hasServerSupabaseEnv } from "@/lib/supabase";
import type { EmployeeAccess, SapValidationResult } from "@/types";

const INVALID_SAP_MESSAGE = "SAP дугаар олдсонгүй. Та дугаараа шалгаад дахин оролдоно уу.";
const INACTIVE_MESSAGE = "Таны like дарах эрх идэвхгүй байна. Админтай холбогдоно уу.";
const EMPLOYEE_SCHEMA_MISSING_MESSAGE =
  "Ажилтны хүснэгт Supabase дээр үүсээгүй байна. Эхлээд supabase/schema.sql файлыг SQL Editor дээр ажиллуулаад, дараа нь /admin/employees хэсгээс Allstaff.xlsx импортлоно уу.";

async function getLikedDrawingIds(employeeId: string) {
  const supabase = createServiceSupabaseClient();
  const { data, error } = await supabase
    .from("votes")
    .select("drawing_id")
    .eq("employee_id", employeeId)
    .is("deleted_at", null);

  if (error) {
    console.error("Unable to load employee liked drawings", error);
    return [];
  }

  return (data ?? []).map((vote) => vote.drawing_id);
}

export async function getCurrentEmployeeAccess(): Promise<EmployeeAccess | null> {
  noStore();

  if (!hasServerSupabaseEnv()) {
    return null;
  }

  const employeeId = await getEmployeeSessionId();
  if (!employeeId) {
    return null;
  }

  const supabase = createServiceSupabaseClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id,sap_code,first_name,last_name,status")
    .eq("id", employeeId)
    .maybeSingle();

  if (error || !employee || employee.status !== "active") {
    return null;
  }

  return {
    ...employee,
    likedDrawingIds: await getLikedDrawingIds(employee.id)
  };
}

export async function getMyLikedDrawingIds() {
  noStore();
  const employee = await getCurrentEmployeeAccess();
  return employee?.likedDrawingIds ?? [];
}

export async function validateSapCode(sapCode: string): Promise<SapValidationResult> {
  noStore();

  if (!hasServerSupabaseEnv()) {
    return { status: "error", message: "Supabase service тохиргоо дутуу байна." };
  }

  const normalizedSap = normalizeSapCode(sapCode);
  if (!normalizedSap) {
    return { status: "invalid", message: INVALID_SAP_MESSAGE };
  }

  const supabase = createServiceSupabaseClient();
  const { data: employee, error } = await supabase
    .from("employees")
    .select("id,sap_code,first_name,last_name,status")
    .eq("sap_code", normalizedSap)
    .maybeSingle();

  if (error) {
    console.error("SAP validation failed", error);
    if (error.code === "PGRST205" || error.message?.includes("public.employees")) {
      return { status: "error", message: EMPLOYEE_SCHEMA_MISSING_MESSAGE };
    }

    return { status: "error", message: "SAP шалгахад алдаа гарлаа. Дахин оролдоно уу." };
  }

  if (!employee) {
    return { status: "invalid", message: INVALID_SAP_MESSAGE };
  }

  if (employee.status !== "active") {
    return { status: "inactive", message: INACTIVE_MESSAGE };
  }

  await setEmployeeSession(employee.id);
  const access: EmployeeAccess = {
    ...employee,
    likedDrawingIds: await getLikedDrawingIds(employee.id)
  };

  revalidatePath("/");
  return {
    status: "success",
    message: `Тавтай морилно уу, ${employee.first_name} ${employee.last_name}`,
    employee: access
  };
}

export async function logoutEmployee() {
  await clearEmployeeSession();
  revalidatePath("/");
}
