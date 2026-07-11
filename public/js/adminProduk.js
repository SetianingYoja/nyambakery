import { supabase } from "./supabaseClient.js";

export async function ambilSemuaProdukAdmin() {
  const { data, error } = await supabase
    .from("produk")
    .select("*, kategori_produk(nama_kategori)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function ambilProdukById(id) {
  const { data, error } = await supabase.from("produk").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function uploadGambarProduk(file) {
  const namaFile = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const { error } = await supabase.storage.from("produk").upload(namaFile, file);
  if (error) throw error;
  const { data } = supabase.storage.from("produk").getPublicUrl(namaFile);
  return data.publicUrl;
}

export async function tambahProduk(produk) {
  const { data, error } = await supabase.from("produk").insert(produk).select().single();
  if (error) throw error;
  return data;
}

export async function updateProduk(id, produk) {
  const { error } = await supabase.from("produk").update(produk).eq("id", id);
  if (error) throw error;
}

export async function hapusProduk(id) {
  const { error } = await supabase.from("produk").delete().eq("id", id);
  if (error) throw error;
}

export async function arsipkanProduk(id, diarsipkan) {
  const { error } = await supabase.from("produk").update({ diarsipkan }).eq("id", id);
  if (error) throw error;
}
