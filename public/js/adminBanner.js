import { supabase } from "./supabaseClient.js";

export async function ambilSemuaBanner() {
  const { data, error } = await supabase.from("banner").select("*").order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function uploadGambarBanner(file) {
  const namaFile = `banner_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const { error } = await supabase.storage.from("produk").upload(namaFile, file);
  if (error) throw error;
  const { data } = supabase.storage.from("produk").getPublicUrl(namaFile);
  return data.publicUrl;
}

export async function tambahBanner(banner) {
  const { error } = await supabase.from("banner").insert(banner);
  if (error) throw error;
}

export async function updateBanner(id, banner) {
  const { error } = await supabase.from("banner").update(banner).eq("id", id);
  if (error) throw error;
}

export async function hapusBanner(id) {
  const { error } = await supabase.from("banner").delete().eq("id", id);
  if (error) throw error;
}
