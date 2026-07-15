// =====================================================================
// Pengganti checkout.php + checkout_sukses.php
// =====================================================================
import { supabase } from "./supabaseClient.js";
import { ambilIsiKeranjang } from "./cart.js";

export async function ambilAlamat(userId) {
  const { data, error } = await supabase
    .from("alamat_pengiriman")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false });
  if (error) throw error;
  return data;
}

export async function tambahAlamat({ userId, ...alamat }) {
  const { data, error } = await supabase
    .from("alamat_pengiriman")
    .insert({ user_id: userId, ...alamat })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function validasiVoucher(kode, subtotal) {
  const { data: voucher, error } = await supabase
    .from("voucher")
    .select("*")
    .eq("kode", kode)
    .eq("aktif", true)
    .maybeSingle();
  if (error) throw error;
  if (!voucher) throw new Error("Voucher tidak ditemukan atau tidak aktif.");

  const today = new Date().toISOString().slice(0, 10);
  if (voucher.tanggal_mulai && today < voucher.tanggal_mulai) throw new Error("Voucher belum berlaku.");
  if (voucher.tanggal_selesai && today > voucher.tanggal_selesai) throw new Error("Voucher sudah kedaluwarsa.");
  if (voucher.minimal_belanja && subtotal < voucher.minimal_belanja) {
    throw new Error(`Minimal belanja Rp ${Number(voucher.minimal_belanja).toLocaleString("id-ID")} untuk voucher ini.`);
  }

  const diskon = voucher.tipe_diskon === "persen"
    ? Math.round(subtotal * (voucher.nilai_diskon / 100))
    : Number(voucher.nilai_diskon);

  return { voucher, diskon };
}

function buatNomorPesanan() {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
  return `INV-${stamp}-${Math.floor(Math.random() * 900 + 100)}`;
}

export async function buatPesanan({ userId, alamatId, ongkir = 0, diskon = 0, metodePembayaran, catatan }) {
  const items = await ambilIsiKeranjang(userId);
  if (items.length === 0) throw new Error("Keranjang kosong.");

  const subtotal = items.reduce((total, item) => {
    const hargaSatuan = Number(item.produk.harga) + Number(item.varian_produk?.harga_tambahan ?? 0);
    return total + hargaSatuan * item.qty;
  }, 0);
  const totalBayar = subtotal - diskon + ongkir;

  const { data: pesanan, error: pesananError } = await supabase
    .from("pesanan")
    .insert({
      user_id: userId,
      alamat_id: alamatId,
      nomor_pesanan: buatNomorPesanan(),
      subtotal,
      diskon,
      ongkir,
      total_bayar: totalBayar,
      metode_pembayaran: metodePembayaran,
      status_pesanan: "menunggu",
      catatan,
    })
    .select()
    .single();
  if (pesananError) throw pesananError;

  const detailRows = items.map((item) => ({
    pesanan_id: pesanan.id,
    produk_id: item.produk_id,
    varian_id: item.varian_id,
    harga: Number(item.produk.harga) + Number(item.varian_produk?.harga_tambahan ?? 0),
    qty: item.qty,
    subtotal: (Number(item.produk.harga) + Number(item.varian_produk?.harga_tambahan ?? 0)) * item.qty,
  }));

  const { error: detailError } = await supabase.from("detail_pesanan").insert(detailRows);
  if (detailError) throw detailError;

  const { error: bayarError } = await supabase.from("pembayaran").insert({
    pesanan_id: pesanan.id,
    metode: metodePembayaran,
    nominal: totalBayar,
    status: "pending",
  });
  if (bayarError) throw bayarError;

  // Kosongkan item keranjang yang sudah jadi pesanan
  const itemIds = items.map((item) => item.id);
  await supabase.from("item_keranjang").delete().in("id", itemIds);

  return pesanan;
}

export async function ambilPesananSaya(userId) {
  const { data, error } = await supabase
    .from("pesanan")
    .select("*, detail_pesanan(*, produk(nama_produk, thumbnail))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
