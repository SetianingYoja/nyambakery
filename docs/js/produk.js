// =====================================================================
// Pengganti katalog.php + detail_produk.php + api_produk.php
// =====================================================================
import { supabase } from "./supabaseClient.js";

export async function ambilKategori() {
  const { data, error } = await supabase
    .from("kategori_produk")
    .select("*")
    .order("nama_kategori", { ascending: true });
  if (error) throw error;
  return data;
}

// filter: { kategoriId, cari, hargaMin, hargaMax }
export async function ambilProduk(filter = {}) {
  let query = supabase
    .from("produk")
    .select("*, kategori_produk(nama_kategori)")
    .eq("diarsipkan", false)
    .order("created_at", { ascending: false });

  if (filter.kategoriId) query = query.eq("kategori_id", filter.kategoriId);
  if (filter.cari) query = query.ilike("nama_produk", `%${filter.cari}%`);
  if (filter.hargaMin) query = query.gte("harga", filter.hargaMin);
  if (filter.hargaMax) query = query.lte("harga", filter.hargaMax);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function ambilBannerAktif() {
  const { data, error } = await supabase
    .from("banner")
    .select("*")
    .eq("aktif", true)
    .order("id", { ascending: true })
    .limit(5);
  if (error) throw error;
  return data;
}

export async function ambilDetailProduk(idAtauSlug) {
  const kolom = /^\d+$/.test(String(idAtauSlug)) ? "id" : "slug";

  const { data: produk, error } = await supabase
    .from("produk")
    .select("*, kategori_produk(nama_kategori)")
    .eq(kolom, idAtauSlug)
    .single();
  if (error) throw error;

  const [{ data: galeri }, { data: varian }, { data: review }] = await Promise.all([
    supabase.from("galeri_produk").select("*").eq("produk_id", produk.id),
    supabase.from("varian_produk").select("*").eq("produk_id", produk.id),
    supabase.from("review_produk").select("*, users(nama_lengkap)").eq("produk_id", produk.id).order("created_at", { ascending: false }),
  ]);

  return { produk, galeri: galeri ?? [], varian: varian ?? [], review: review ?? [] };
}

export async function tambahUlasan({ produkId, userId, rating, komentar }) {
  const { error } = await supabase
    .from("review_produk")
    .insert({ produk_id: produkId, user_id: userId, rating, komentar });
  if (error) throw error;
}
