"use server";

import { unstable_noStore as noStore } from "next/cache";
import { createPublicSupabaseClient, hasPublicSupabaseEnv } from "@/lib/supabase";
import type { Drawing } from "@/types";

export async function getDrawings(): Promise<Drawing[]> {
  noStore();

  if (!hasPublicSupabaseEnv()) {
    return [];
  }

  const supabase = createPublicSupabaseClient();
  const { data, error } = await supabase
    .from("drawings")
    .select("id,title,child_name,age_category,image_url,created_at")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load drawings", error);
    return [];
  }

  return data ?? [];
}
