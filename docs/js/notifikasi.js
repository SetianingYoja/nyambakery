import { supabase } from "./supabaseClient.js";

export async function ambilNotifikasi(userId) {
  const { data, error } = await supabase
    .from("notifikasi")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function tandaiSudahDibaca(id) {
  const { error } = await supabase.from("notifikasi").update({ dibaca: true }).eq("id", id);
  if (error) throw error;
}

export async function hitungBelumDibaca(userId) {
  const { count, error } = await supabase
    .from("notifikasi")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("dibaca", false);
  if (error) throw error;
  return count ?? 0;
}
