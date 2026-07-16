import { supabase } from "./supabaseClient.js";

// Riwayat percakapan disimpan di memori saja (tidak ke database),
// mengikuti pola stateless: kirim ulang seluruh riwayat setiap panggilan.
let riwayatPercakapan = [];

export function resetPercakapanAi() {
  riwayatPercakapan = [];
}

export async function tanyaAsistenAi(pesan) {
  const { data, error } = await supabase.functions.invoke("ai-admin-assistant", {
    body: { pesan, riwayat: riwayatPercakapan },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  riwayatPercakapan.push({ role: "user", parts: [{ text: pesan }] });
  riwayatPercakapan.push({ role: "model", parts: [{ text: data.jawaban }] });

  return data.jawaban;
}
