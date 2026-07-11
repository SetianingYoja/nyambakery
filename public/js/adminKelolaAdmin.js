import { supabase } from "./supabaseClient.js";

export async function ambilSemuaAdmin() {
  const { data, error } = await supabase.from("admin").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function daftarkanProfilAdmin({ id, username, nama_lengkap, email, role }) {
  const { error } = await supabase.from("admin").insert({ id, username, nama_lengkap, email, role, status: "Aktif" });
  if (error) throw error;
}

export async function updateAdmin(id, data) {
  const { error } = await supabase.from("admin").update(data).eq("id", id);
  if (error) throw error;
}

export async function hapusProfilAdmin(id) {
  const { error } = await supabase.from("admin").delete().eq("id", id);
  if (error) throw error;
}
