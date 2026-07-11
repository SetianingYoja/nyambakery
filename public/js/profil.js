import { supabase } from "./supabaseClient.js";

export async function updateProfil(userId, { nama_lengkap, no_hp, foto_profil }) {
  const { error } = await supabase
    .from("users")
    .update({ nama_lengkap, no_hp, foto_profil })
    .eq("id", userId);
  if (error) throw error;
}

export async function uploadFotoProfil(file, userId) {
  const namaFile = `profil_${userId}_${Date.now()}.${file.name.split(".").pop()}`;
  const { error } = await supabase.storage.from("produk").upload(namaFile, file);
  if (error) throw error;
  const { data } = supabase.storage.from("produk").getPublicUrl(namaFile);
  return data.publicUrl;
}

export async function gantiPassword(passwordBaru) {
  const { error } = await supabase.auth.updateUser({ password: passwordBaru });
  if (error) throw error;
}
