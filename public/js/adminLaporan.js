import { supabase } from "./supabaseClient.js";

export async function ambilLaporanPenjualan({ dariTanggal, sampaiTanggal }) {
  let query = supabase
    .from("pesanan")
    .select("id, nomor_pesanan, total_bayar, status_pesanan, created_at")
    .neq("status_pesanan", "dibatalkan")
    .order("created_at", { ascending: false });

  if (dariTanggal) query = query.gte("created_at", dariTanggal);
  if (sampaiTanggal) query = query.lte("created_at", sampaiTanggal + "T23:59:59");

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function ambilProdukTerlaris(limit = 10) {
  const { data, error } = await supabase
    .from("produk")
    .select("nama_produk, total_terjual")
    .order("total_terjual", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
