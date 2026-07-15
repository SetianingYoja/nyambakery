import { supabase } from "./supabaseClient.js";

export async function ambilPengaturanAi() {
  const { data, error } = await supabase
    .from("ai_agent_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePengaturanAi(id, data) {
  const { error } = await supabase
    .from("ai_agent_settings")
    .update(data)
    .eq("id", id);
  if (error) throw error;
}