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
    .from("public_drawings_with_votes")
    .select("id,title,child_name,age_category,image_url,created_at,vote_count")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load drawings", error);
    const fallback = await supabase
      .from("drawings")
      .select("id,title,child_name,age_category,image_url,created_at")
      .order("created_at", { ascending: false });

    if (fallback.error) {
      console.error("Unable to load fallback drawings", fallback.error);
      return [];
    }

    return (fallback.data ?? []).map((drawing) => ({ ...drawing, vote_count: 0 }));
  }

  return data ?? [];
}
