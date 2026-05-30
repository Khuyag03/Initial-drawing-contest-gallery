"use server";

import { readSheet } from "read-excel-file/node";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { normalizeSapCode } from "@/lib/employee-auth";
import { createServiceSupabaseClient, getServerSupabaseEnvError, hasServerSupabaseEnv } from "@/lib/supabase";
import { isEmployeeStatus, isUuid, readText } from "@/lib/validators";
import type { ActionState, AdminEmployeeRow, AdminVoteRecord, EmployeeImportSummary, EmployeeStatus } from "@/types";

const ok = (message: string): ActionState => ({ status: "success", message });
const fail = (message: string): ActionState => ({ status: "error", message });

function isFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value
  );
}

function refreshAdminData() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/votes");
}

function normalizeName(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 140);
}

function cellText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function envFailure(): EmployeeImportSummary {
  return {
    status: "error",
    message: getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна."
  };
}

export async function getAdminEmployees(): Promise<AdminEmployeeRow[]> {
  noStore();
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return [];
  }

  const supabase = createServiceSupabaseClient();
  const [{ data: employees, error: employeesError }, { data: votes, error: votesError }] = await Promise.all([
    supabase.from("employees").select("*").order("created_at", { ascending: false }),
    supabase.from("votes").select("employee_id,created_at,deleted_at")
  ]);

  if (employeesError) {
    console.error("Unable to load employees", employeesError);
    return [];
  }

  if (votesError) {
    console.error("Unable to load employee vote summaries", votesError);
  }

  const summaries = new Map<string, { votesUsed: number; lastVoteDate: string | null }>();
  for (const vote of votes ?? []) {
    if (!vote.employee_id || vote.deleted_at) {
      continue;
    }

    const current = summaries.get(vote.employee_id) ?? { votesUsed: 0, lastVoteDate: null };
    current.votesUsed += 1;
    if (!current.lastVoteDate || new Date(vote.created_at) > new Date(current.lastVoteDate)) {
      current.lastVoteDate = vote.created_at;
    }
    summaries.set(vote.employee_id, current);
  }

  return (employees ?? []).map((employee) => {
    const summary = summaries.get(employee.id);
    return {
      ...employee,
      votes_used: summary?.votesUsed ?? 0,
      last_vote_date: summary?.lastVoteDate ?? null
    };
  });
}

export async function adminImportEmployees(formData: FormData): Promise<EmployeeImportSummary> {
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return envFailure();
  }

  const file = formData.get("file");
  const resetStatus = formData.get("resetStatus") === "on";
  if (!isFile(file) || file.size === 0) {
    return { status: "error", message: "Excel файл сонгоно уу." };
  }

  let rows: unknown[][];
  try {
    rows = await readSheet(Buffer.from(await file.arrayBuffer()), "Employees");
  } catch (error) {
    console.error("Employee Excel read failed", error);
    return { status: "error", message: "Employees sheet олдсонгүй." };
  }

  const [headerRow, ...dataRows] = rows;
  const columnMap = new Map<string, number>();
  headerRow?.forEach((value, index) => {
    columnMap.set(cellText(value).trim(), index);
  });

  const sapColumn = columnMap.get("SAP");
  const firstNameColumn = columnMap.get("First Name");
  const lastNameColumn = columnMap.get("Last Name");

  if (sapColumn === undefined || firstNameColumn === undefined || lastNameColumn === undefined) {
    return { status: "error", message: "SAP, First Name, Last Name баганууд олдсонгүй." };
  }

  const errors: string[] = [];
  const parsed = new Map<string, { sap_code: string; first_name: string; last_name: string; status?: EmployeeStatus; updated_at: string }>();
  let skipped = 0;

  dataRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const sapCode = normalizeSapCode(cellText(row[sapColumn]));
    const firstName = normalizeName(cellText(row[firstNameColumn]));
    const lastName = normalizeName(cellText(row[lastNameColumn]));

    if (!sapCode) {
      skipped += 1;
      return;
    }

    if (!firstName || !lastName) {
      skipped += 1;
      errors.push(`Row ${rowNumber}: First Name эсвэл Last Name дутуу байна.`);
      return;
    }

    parsed.set(sapCode, {
      sap_code: sapCode,
      first_name: firstName,
      last_name: lastName,
      ...(resetStatus ? { status: "active" as const } : {}),
      updated_at: new Date().toISOString()
    });
  });

  const totalRows = dataRows.length;

  const employees = [...parsed.values()];
  if (employees.length === 0) {
    return {
      status: "error",
      message: "Импортлох ажилтан олдсонгүй.",
      totalRows,
      imported: 0,
      updated: 0,
      skipped,
      errors
    };
  }

  const supabase = createServiceSupabaseClient();
  const { data: existing, error: existingError } = await supabase.from("employees").select("sap_code");
  if (existingError) {
    console.error("Unable to load existing employees", existingError);
    return { status: "error", message: "Одоогийн ажилтны жагсаалт уншихад алдаа гарлаа." };
  }

  const existingSapCodes = new Set((existing ?? []).map((employee) => employee.sap_code));
  const updated = employees.filter((employee) => existingSapCodes.has(employee.sap_code)).length;
  const imported = employees.length - updated;

  const { error } = await supabase.from("employees").upsert(employees, { onConflict: "sap_code" });
  if (error) {
    console.error("Employee import failed", error);
    return { status: "error", message: `Импорт хийхэд алдаа гарлаа: ${error.message}` };
  }

  refreshAdminData();
  return {
    status: "success",
    message: `Импорт дууслаа: ${imported} шинэ, ${updated} шинэчлэгдсэн.`,
    totalRows,
    imported,
    updated,
    skipped,
    errors
  };
}

export async function adminAddEmployee(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  const sapCode = normalizeSapCode(readText(formData, "sapCode", 64));
  const firstName = readText(formData, "firstName", 140);
  const lastName = readText(formData, "lastName", 140);
  const status = readText(formData, "status", 24);

  if (!sapCode || !firstName || !lastName || !isEmployeeStatus(status)) {
    return fail("Ажилтны мэдээлэл дутуу эсвэл буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.from("employees").insert({
    sap_code: sapCode,
    first_name: firstName,
    last_name: lastName,
    status
  });

  if (error) {
    console.error("Add employee failed", error);
    return fail(`Ажилтан нэмэхэд алдаа гарлаа: ${error.message}`);
  }

  refreshAdminData();
  return ok("Ажилтан нэмэгдлээ.");
}

export async function adminUpdateEmployee(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  const id = readText(formData, "id", 64);
  const firstName = readText(formData, "firstName", 140);
  const lastName = readText(formData, "lastName", 140);
  const status = readText(formData, "status", 24);

  if (!isUuid(id) || !firstName || !lastName || !isEmployeeStatus(status)) {
    return fail("Ажилтны мэдээлэл дутуу эсвэл буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("employees")
    .update({ first_name: firstName, last_name: lastName, status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Update employee failed", error);
    return fail("Ажилтан засахад алдаа гарлаа.");
  }

  refreshAdminData();
  return ok("Ажилтны мэдээлэл шинэчлэгдлээ.");
}

export async function adminUpdateEmployeeStatus(employeeId: string, status: EmployeeStatus): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  if (!isUuid(employeeId) || !isEmployeeStatus(status)) {
    return fail("Ажилтны төлөв буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("employees")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", employeeId);

  if (error) {
    console.error("Update employee status failed", error);
    return fail("Төлөв шинэчлэхэд алдаа гарлаа.");
  }

  refreshAdminData();
  return ok("Төлөв шинэчлэгдлээ.");
}

export async function adminResetEmployeeVotes(employeeId: string): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  if (!isUuid(employeeId)) {
    return fail("Ажилтны ID буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("votes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: "admin",
      delete_reason: "Admin reset voting rights"
    })
    .eq("employee_id", employeeId)
    .is("deleted_at", null);

  if (error) {
    console.error("Reset employee votes failed", error);
    return fail("Саналын эрх шинэчлэхэд алдаа гарлаа.");
  }

  refreshAdminData();
  return ok("Ажилтны бүх like хасагдлаа.");
}

export async function adminResetAllEmployeeVotes(): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("votes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: "admin",
      delete_reason: "Admin reset all voting rights"
    })
    .is("deleted_at", null);

  if (error) {
    console.error("Reset all votes failed", error);
    return fail("Бүх like хасахад алдаа гарлаа.");
  }

  refreshAdminData();
  return ok("Бүх ажилтны like хасагдлаа.");
}

export async function adminDeleteEmployee(employeeId: string): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  if (!isUuid(employeeId)) {
    return fail("Ажилтны ID буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase.from("employees").delete().eq("id", employeeId);

  if (error) {
    console.error("Delete employee failed", error);
    return fail("Ажилтан устгахад алдаа гарлаа.");
  }

  refreshAdminData();
  return ok("Ажилтан устгагдлаа.");
}

export async function getAdminVoteRecords(): Promise<AdminVoteRecord[]> {
  noStore();
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return [];
  }

  const supabase = createServiceSupabaseClient();
  const [{ data: votes, error: votesError }, { data: drawings, error: drawingsError }] = await Promise.all([
    supabase
      .from("votes")
      .select("id,drawing_id,sap_code,employee_first_name,employee_last_name,age_category,browser_summary,created_at,deleted_at")
      .order("created_at", { ascending: false }),
    supabase.from("drawings").select("id,title,child_name")
  ]);

  if (votesError) {
    console.error("Unable to load vote records", votesError);
    return [];
  }

  if (drawingsError) {
    console.error("Unable to load vote record drawings", drawingsError);
  }

  const drawingMap = new Map((drawings ?? []).map((drawing) => [drawing.id, drawing]));
  return (votes ?? []).map((vote) => {
    const drawing = drawingMap.get(vote.drawing_id);
    return {
      id: vote.id,
      created_at: vote.created_at,
      deleted_at: vote.deleted_at,
      sap_code: vote.sap_code,
      employee_first_name: vote.employee_first_name,
      employee_last_name: vote.employee_last_name,
      age_category: vote.age_category,
      browser_summary: vote.browser_summary,
      drawing_title: drawing?.title ?? "Устсан зураг",
      drawing_child_name: drawing?.child_name ?? null
    };
  });
}

export async function adminDeleteVote(voteId: string): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  if (!isUuid(voteId)) {
    return fail("Саналын ID буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("votes")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: "admin",
      delete_reason: "Admin removed vote"
    })
    .eq("id", voteId)
    .is("deleted_at", null);

  if (error) {
    console.error("Delete vote failed", error);
    return fail("Like хасахад алдаа гарлаа.");
  }

  refreshAdminData();
  return ok("Like хасагдлаа.");
}

export async function adminRestoreVote(voteId: string): Promise<ActionState> {
  await requireAdmin();
  if (!hasServerSupabaseEnv()) {
    return fail(getServerSupabaseEnvError() || "Supabase service тохиргоо дутуу байна.");
  }

  if (!isUuid(voteId)) {
    return fail("Саналын ID буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { error } = await supabase
    .from("votes")
    .update({ deleted_at: null, deleted_by: null, delete_reason: null })
    .eq("id", voteId);

  if (error) {
    console.error("Restore vote failed", error);
    return fail(`Like сэргээхэд алдаа гарлаа: ${error.message}`);
  }

  refreshAdminData();
  return ok("Like сэргээгдлээ.");
}
