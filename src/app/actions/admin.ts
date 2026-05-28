"use server";

import { randomUUID } from "crypto";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { clearAdminSession, createAdminSession, isAdminConfigured, requireAdmin } from "@/lib/admin-auth";
import { createServiceSupabaseClient, DRAWING_BUCKET, hasServerSupabaseEnv } from "@/lib/supabase";
import { isAgeCategory, isUuid, readText } from "@/lib/validators";
import type {
  ActionState,
  AdminDrawingResult,
  DrawingUploadInput,
  FinalizeDrawingUploadInput,
  PreparedDrawingUpload
} from "@/types";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"]
]);

const ok = (message: string): ActionState => ({ status: "success", message });
const fail = (message: string): ActionState => ({ status: "error", message });

function isFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    "type" in value
  );
}

function validateImage(file: File) {
  if (!file || file.size === 0) {
    return "Зургийн файл сонгоно уу.";
  }

  if (file.size > MAX_IMAGE_SIZE) {
    return "Зураг 10MB-аас бага хэмжээтэй байх хэрэгтэй.";
  }

  if (!IMAGE_TYPES.has(file.type)) {
    return "Зөвхөн JPG, PNG, WEBP эсвэл GIF зураг оруулна уу.";
  }

  return null;
}

function validateImageMetadata(size: number, contentType: string) {
  if (!Number.isFinite(size) || size <= 0) {
    return "Зургийн файл сонгоно уу.";
  }

  if (size > MAX_IMAGE_SIZE) {
    return "Зураг 10MB-аас бага хэмжээтэй байх хэрэгтэй.";
  }

  if (!IMAGE_TYPES.has(contentType)) {
    return "Зөвхөн JPG, PNG, WEBP эсвэл GIF зураг оруулна уу.";
  }

  return null;
}

function getPublicPathFromImageUrl(imageUrl: string) {
  const marker = `/storage/v1/object/public/${DRAWING_BUCKET}/`;
  const index = imageUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(imageUrl.slice(index + marker.length).split("?")[0] || "");
}

function getPublicImageUrl(filePath: string) {
  const supabase = createServiceSupabaseClient();
  const { data } = supabase.storage.from(DRAWING_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

async function uploadImage(file: File, ageCategory: string) {
  const supabase = createServiceSupabaseClient();
  const extension = IMAGE_TYPES.get(file.type) || "jpg";
  const filePath = `${ageCategory}/${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage.from(DRAWING_BUCKET).upload(filePath, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false
  });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage.from(DRAWING_BUCKET).getPublicUrl(filePath);
  return { imageUrl: data.publicUrl, filePath };
}

type DrawingFieldResult =
  | {
      ok: true;
      title: string;
      childName: string | null;
      ageCategory: "3-6" | "7-10" | "11-16";
    }
  | {
      ok: false;
      error: string;
    };

function normalizePlainText(value: unknown, maxLength = 160) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function validateDrawingInput(input: {
  title?: unknown;
  childName?: unknown;
  ageCategory?: unknown;
}): DrawingFieldResult {
  const title = normalizePlainText(input.title, 180);
  const childName = normalizePlainText(input.childName, 120);
  const ageCategory = normalizePlainText(input.ageCategory, 16);

  if (!title) {
    return { ok: false, error: "Зургийн нэр оруулна уу." };
  }

  if (!isAgeCategory(ageCategory)) {
    return { ok: false, error: "Насны ангилал буруу байна." };
  }

  return {
    ok: true,
    title,
    childName: childName || null,
    ageCategory
  };
}

function validateDrawingFields(formData: FormData): DrawingFieldResult {
  const title = readText(formData, "title", 180);
  const childName = readText(formData, "childName", 120);
  const ageCategory = readText(formData, "ageCategory", 16);

  if (!title) {
    return { ok: false, error: "Зургийн нэр оруулна уу." };
  }

  if (!isAgeCategory(ageCategory)) {
    return { ok: false, error: "Насны ангилал буруу байна." };
  }

  return {
    ok: true,
    title,
    childName: childName || null,
    ageCategory
  };
}

function refreshAdminPages() {
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function prepareDrawingUpload(input: DrawingUploadInput): Promise<PreparedDrawingUpload> {
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return fail("Supabase service тохиргоо дутуу байна.");
  }

  const fields = validateDrawingInput(input);
  if (!fields.ok) {
    return fail(fields.error);
  }

  const imageError = validateImageMetadata(input.size, input.contentType);
  if (imageError) {
    return fail(imageError);
  }

  const supabase = createServiceSupabaseClient();
  const extension = IMAGE_TYPES.get(input.contentType) || "jpg";
  const filePath = `${fields.ageCategory}/${randomUUID()}.${extension}`;
  const { data, error } = await supabase.storage.from(DRAWING_BUCKET).createSignedUploadUrl(filePath);

  if (error || !data) {
    console.error("Create signed upload URL failed", error);
    return fail(`Storage upload link үүсгэхэд алдаа гарлаа: ${error?.message || "unknown error"}`);
  }

  return {
    status: "success",
    message: "",
    upload: {
      path: data.path,
      token: data.token,
      cacheControl: "31536000"
    }
  };
}

export async function finalizeDrawingUpload(input: FinalizeDrawingUploadInput): Promise<ActionState> {
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return fail("Supabase service тохиргоо дутуу байна.");
  }

  const fields = validateDrawingInput(input);
  if (!fields.ok) {
    return fail(fields.error);
  }

  const filePath = normalizePlainText(input.filePath, 260);
  if (!filePath || !filePath.startsWith(`${fields.ageCategory}/`)) {
    return fail("Зургийн storage path буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const imageUrl = getPublicImageUrl(filePath);
  const { error } = await supabase.from("drawings").insert({
    title: fields.title,
    child_name: fields.childName,
    age_category: fields.ageCategory,
    image_url: imageUrl
  });

  if (error) {
    await supabase.storage.from(DRAWING_BUCKET).remove([filePath]);
    console.error("Finalize drawing upload failed", error);
    return fail(`Зургийн мэдээлэл хадгалахад алдаа гарлаа: ${error.message}`);
  }

  refreshAdminPages();
  return ok("Зураг амжилттай нэмэгдлээ.");
}

export async function loginAdmin(_previousState: ActionState, formData: FormData): Promise<ActionState> {
  const password = readText(formData, "password", 240);

  if (!isAdminConfigured()) {
    return fail("ADMIN_PASSWORD тохируулагдаагүй байна.");
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return fail("Нууц үг буруу байна.");
  }

  await createAdminSession();
  redirect("/admin");
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/login");
}

export async function getAdminResults(): Promise<AdminDrawingResult[]> {
  noStore();
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return [];
  }

  const supabase = createServiceSupabaseClient();
  const [{ data: drawings, error: drawingsError }, { data: votes, error: votesError }] =
    await Promise.all([
      supabase
        .from("drawings")
        .select("id,title,child_name,age_category,image_url,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("votes").select("drawing_id")
    ]);

  if (drawingsError) {
    console.error("Unable to load admin drawings", drawingsError);
    return [];
  }

  if (votesError) {
    console.error("Unable to load admin votes", votesError);
  }

  const counts = new Map<string, number>();
  for (const vote of votes ?? []) {
    counts.set(vote.drawing_id, (counts.get(vote.drawing_id) ?? 0) + 1);
  }

  return (drawings ?? []).map((drawing) => ({
    ...drawing,
    vote_count: counts.get(drawing.id) ?? 0
  }));
}

export async function uploadDrawing(formData: FormData): Promise<ActionState> {
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return fail("Supabase service тохиргоо дутуу байна.");
  }

  const fields = validateDrawingFields(formData);
  if (!fields.ok) {
    return fail(fields.error);
  }

  const image = formData.get("image");
  if (!isFile(image)) {
    return fail("Зургийн файл сонгоно уу.");
  }

  const imageError = validateImage(image);
  if (imageError) {
    return fail(imageError);
  }

  const supabase = createServiceSupabaseClient();
  let uploadedPath: string | null = null;

  try {
    const uploaded = await uploadImage(image, fields.ageCategory);
    uploadedPath = uploaded.filePath;

    const { error } = await supabase.from("drawings").insert({
      title: fields.title,
      child_name: fields.childName,
      age_category: fields.ageCategory,
      image_url: uploaded.imageUrl
    });

    if (error) {
      throw new Error(error.message);
    }

    refreshAdminPages();
    return ok("Зураг амжилттай нэмэгдлээ.");
  } catch (error) {
    if (uploadedPath) {
      await supabase.storage.from(DRAWING_BUCKET).remove([uploadedPath]);
    }

    console.error("Upload drawing failed", error);
    return fail("Зураг нэмэхэд алдаа гарлаа.");
  }
}

export async function updateDrawing(formData: FormData): Promise<ActionState> {
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return fail("Supabase service тохиргоо дутуу байна.");
  }

  const id = readText(formData, "id", 64);
  if (!isUuid(id)) {
    return fail("Зургийн ID буруу байна.");
  }

  const fields = validateDrawingFields(formData);
  if (!fields.ok) {
    return fail(fields.error);
  }

  const supabase = createServiceSupabaseClient();
  const { data: current, error: currentError } = await supabase
    .from("drawings")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  if (currentError || !current) {
    return fail("Зураг олдсонгүй.");
  }

  const replacementImage = formData.get("image");
  let replacementPath: string | null = null;
  let replacementImageUrl: string | null = null;

  if (isFile(replacementImage) && replacementImage.size > 0) {
    const imageError = validateImage(replacementImage);
    if (imageError) {
      return fail(imageError);
    }

    try {
      const uploaded = await uploadImage(replacementImage, fields.ageCategory);
      replacementPath = uploaded.filePath;
      replacementImageUrl = uploaded.imageUrl;
    } catch (error) {
      console.error("Replacement image upload failed", error);
      return fail("Шинэ зураг оруулахад алдаа гарлаа.");
    }
  }

  const { error } = await supabase
    .from("drawings")
    .update({
      title: fields.title,
      child_name: fields.childName,
      age_category: fields.ageCategory,
      ...(replacementImageUrl ? { image_url: replacementImageUrl } : {})
    })
    .eq("id", id);

  if (error) {
    if (replacementPath) {
      await supabase.storage.from(DRAWING_BUCKET).remove([replacementPath]);
    }

    console.error("Update drawing failed", error);
    return fail("Зураг засахад алдаа гарлаа.");
  }

  if (replacementImageUrl) {
    const oldPath = getPublicPathFromImageUrl(current.image_url);
    if (oldPath) {
      await supabase.storage.from(DRAWING_BUCKET).remove([oldPath]);
    }
  }

  refreshAdminPages();
  return ok("Зураг амжилттай шинэчлэгдлээ.");
}

export async function deleteDrawing(formData: FormData): Promise<ActionState> {
  await requireAdmin();

  if (!hasServerSupabaseEnv()) {
    return fail("Supabase service тохиргоо дутуу байна.");
  }

  const id = readText(formData, "id", 64);
  if (!isUuid(id)) {
    return fail("Зургийн ID буруу байна.");
  }

  const supabase = createServiceSupabaseClient();
  const { data: drawing, error: lookupError } = await supabase
    .from("drawings")
    .select("image_url")
    .eq("id", id)
    .maybeSingle();

  if (lookupError || !drawing) {
    return fail("Зураг олдсонгүй.");
  }

  const { error } = await supabase.from("drawings").delete().eq("id", id);
  if (error) {
    console.error("Delete drawing failed", error);
    return fail("Зураг устгахад алдаа гарлаа.");
  }

  const path = getPublicPathFromImageUrl(drawing.image_url);
  if (path) {
    await supabase.storage.from(DRAWING_BUCKET).remove([path]);
  }

  refreshAdminPages();
  return ok("Зураг устгагдлаа.");
}
