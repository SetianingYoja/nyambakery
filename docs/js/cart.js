// =====================================================================
// Pengganti cart.php + cart_action.php + tambah_keranjang.php +
// simpan_pendingcart.php
//
// Bedanya dengan versi lama: keranjang sekarang tersimpan di database
// (tabel keranjang/item_keranjang), bukan session PHP, jadi ikut
// pelanggan login di device manapun.
// =====================================================================
import { supabase } from "./supabaseClient.js";

// Pastikan setiap user punya 1 baris di tabel `keranjang`, kembalikan id-nya
async function ambilKeranjangId(userId) {
  const { data: existing } = await supabase
    .from("keranjang")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("keranjang")
    .insert({ user_id: userId })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}

export async function tambahKeKeranjang({ userId, produkId, varianId = null, qty = 1 }) {
  // Cek stok dulu
  const { data: produk, error: produkError } = await supabase
    .from("produk")
    .select("jumlah_stok")
    .eq("id", produkId)
    .single();
  if (produkError) throw produkError;
  if (produk.jumlah_stok <= 0) throw new Error("habis");
  if (qty > produk.jumlah_stok) throw new Error("stok");

  const keranjangId = await ambilKeranjangId(userId);

  // Kalau produk (+varian) yang sama sudah ada di cart, tambah qty-nya saja
  let cariExisting = supabase
    .from("item_keranjang")
    .select("id, qty")
    .eq("keranjang_id", keranjangId)
    .eq("produk_id", produkId);
  cariExisting = varianId ? cariExisting.eq("varian_id", varianId) : cariExisting.is("varian_id", null);

  const { data: existingItem } = await cariExisting.maybeSingle();

  if (existingItem) {
    const { error } = await supabase
      .from("item_keranjang")
      .update({ qty: existingItem.qty + qty })
      .eq("id", existingItem.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("item_keranjang")
      .insert({ keranjang_id: keranjangId, produk_id: produkId, varian_id: varianId, qty });
    if (error) throw error;
  }
}

export async function ambilIsiKeranjang(userId) {
  const keranjangId = await ambilKeranjangId(userId);

  const { data, error } = await supabase
    .from("item_keranjang")
    .select("*, produk(nama_produk, harga, thumbnail, jumlah_stok, diskon), varian_produk(nama_varian, harga_tambahan)")
    .eq("keranjang_id", keranjangId);
  if (error) throw error;
  return data;
}

export async function hitungJumlahItemKeranjang(userId) {
  const items = await ambilIsiKeranjang(userId);
  return items.reduce((total, item) => total + item.qty, 0);
}

export async function ubahQtyItem({ itemId, qty, stokTersedia }) {
  if (qty <= 0) return hapusItem(itemId);
  if (qty > stokTersedia) throw new Error("stok");

  const { error } = await supabase.from("item_keranjang").update({ qty }).eq("id", itemId);
  if (error) throw error;
}

export async function hapusItem(itemId) {
  const { error } = await supabase.from("item_keranjang").delete().eq("id", itemId);
  if (error) throw error;
}
