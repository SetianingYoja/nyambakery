import { supabase } from "./supabaseClient.js";

export async function ambilSemuaPromo() {
  const { data, error } = await supabase.from("promo").select("*, produk(nama_produk)").order("urutan", { ascending: true });
  if (error) throw error;
  return data;
}

export async function tambahPromo(promo) {
  const { error } = await supabase.from("promo").insert(promo);
  if (error) throw error;
}

export async function updatePromo(id, promo) {
  const { error } = await supabase.from("promo").update(promo).eq("id", id);
  if (error) throw error;
}

export async function hapusPromo(id) {
  const { error } = await supabase.from("promo").delete().eq("id", id);
  if (error) throw error;
}
