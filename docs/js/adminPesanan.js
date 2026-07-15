import { supabase } from "./supabaseClient.js";

export async function ambilSemuaPesanan(filterStatus = "") {
  let query = supabase
    .from("pesanan")
    .select("*, users(nama_lengkap, username), alamat_pengiriman(*)")
    .order("created_at", { ascending: false });
  if (filterStatus) query = query.eq("status_pesanan", filterStatus);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function ambilDetailPesananAdmin(id) {
  const { data, error } = await supabase
    .from("pesanan")
    .select("*, users(nama_lengkap, username, no_hp), alamat_pengiriman(*), detail_pesanan(*, produk(nama_produk, thumbnail), varian_produk(nama_varian)), pembayaran(*)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data;
}

export async function ubahStatusPesanan(id, status_pesanan) {
  const { error } = await supabase.from("pesanan").update({ status_pesanan }).eq("id", id);
  if (error) throw error;
}
