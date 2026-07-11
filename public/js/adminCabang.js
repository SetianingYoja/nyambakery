import { supabase } from "./supabaseClient.js";

export async function ambilSemuaCabang() {
  const { data, error } = await supabase.from("cabang_toko").select("*").order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function tambahCabang(cabang) {
  const { error } = await supabase.from("cabang_toko").insert(cabang);
  if (error) throw error;
}

export async function updateCabang(id, cabang) {
  const { error } = await supabase.from("cabang_toko").update(cabang).eq("id", id);
  if (error) throw error;
}

export async function hapusCabang(id) {
  const { error } = await supabase.from("cabang_toko").delete().eq("id", id);
  if (error) throw error;
}
