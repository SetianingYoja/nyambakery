import { supabase } from "./supabaseClient.js";

export async function tambahKategori({ nama_kategori, slug }) {
  const { error } = await supabase.from("kategori_produk").insert({ nama_kategori, slug });
  if (error) throw error;
}

export async function updateKategori(id, { nama_kategori, slug }) {
  const { error } = await supabase.from("kategori_produk").update({ nama_kategori, slug }).eq("id", id);
  if (error) throw error;
}

export async function hapusKategori(id) {
  const { error } = await supabase.from("kategori_produk").delete().eq("id", id);
  if (error) throw error;
}
