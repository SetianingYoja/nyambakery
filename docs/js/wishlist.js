import { supabase } from "./supabaseClient.js";

export async function ambilWishlist(userId) {
  const { data, error } = await supabase
    .from("wishlist")
    .select("*, produk(nama_produk, harga, thumbnail, jumlah_stok)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function toggleWishlist({ userId, produkId }) {
  const { data: existing } = await supabase
    .from("wishlist")
    .select("id")
    .eq("user_id", userId)
    .eq("produk_id", produkId)
    .maybeSingle();

  if (existing) {
    await supabase.from("wishlist").delete().eq("id", existing.id);
    return false;
  } else {
    const { error } = await supabase.from("wishlist").insert({ user_id: userId, produk_id: produkId });
    if (error) throw error;
    return true;
  }
}
