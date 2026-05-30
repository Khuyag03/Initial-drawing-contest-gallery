"use server";

import { unstable_noStore as noStore } from "next/cache";
import {
  createPublicSupabaseClient,
  createServiceSupabaseClient,
  hasPublicSupabaseEnv,
  hasServerSupabaseEnv
} from "@/lib/supabase";
import type { Drawing } from "@/types";

async function getDrawingsWithServerCounts(): Promise<Drawing[]> {
  if (!hasServerSupabaseEnv()) {
    return [];
  }

  const supabase = createServiceSupabaseClient();
  const [{ data: drawings, error: drawingsError }, { data: votes, error: votesError }] = await Promise.all([
    supabase
      .from("drawings")
      .select("id,title,child_name,age_category,image_url,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("votes").select("drawing_id").is("deleted_at", null)
  ]);

  if (drawingsError) {
    console.error("Unable to load fallback drawings", drawingsError);
    return [];
  }

  if (votesError) {
    console.error("Unable to load fallback like counts", votesError);
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
    return getDrawingsWithServerCounts();
  }

  return data ?? [];
}
