import { supabase } from "./supabaseClient.js";

export async function ambilSemuaVoucher() {
  const { data, error } = await supabase.from("voucher").select("*").order("id", { ascending: false });
  if (error) throw error;
  return data;
}

export async function tambahVoucher(voucher) {
  const { error } = await supabase.from("voucher").insert(voucher);
  if (error) throw error;
}

export async function updateVoucher(id, voucher) {
  const { error } = await supabase.from("voucher").update(voucher).eq("id", id);
  if (error) throw error;
}

export async function hapusVoucher(id) {
  const { error } = await supabase.from("voucher").delete().eq("id", id);
  if (error) throw error;
}
