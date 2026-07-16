// =====================================================================
// Live chat pelanggan - pengganti simpan_live_chat.php + ambil_chat.php + n8n
//
// Cara kerja lama:
//   Browser -> PHP (InfinityFree) -> webhook n8n -> balik lagi ke PHP -> browser
//   (titik ini yang diblokir InfinityFree)
//
// Cara kerja baru:
//   Browser -> langsung ke Supabase (Postgres + Realtime)
//   Admin melihat pesan baru secara realtime lewat WebSocket bawaan Supabase.
//   Tidak ada server perantara sama sekali, jadi tidak ada yang bisa diblokir
//   oleh hosting statis seperti GitHub Pages.
// =====================================================================
import { supabase } from "./supabaseClient.js";

// Kirim pesan dari pelanggan
export async function kirimChatCustomer({ userId, sessionId, pesan }) {
  const { data, error } = await supabase
    .from("live_chat")
    .insert({
      user_id: userId,
      session_id: sessionId,
      pengirim: "customer",
      pesan,
      status: "menunggu_admin",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Kirim balasan dari admin
export async function kirimChatAdmin({ userId, sessionId, pesan }) {
  const { data, error } = await supabase
    .from("live_chat")
    .insert({
      user_id: userId,
      session_id: sessionId,
      pengirim: "admin",
      pesan,
      status: "ditangani_admin",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Panggil AI Agent supaya (kalau lagi aktif) otomatis membalas pesan
// pelanggan yang barusan terkirim. Dipanggil setelah kirimChatCustomer().
// Aman untuk gagal diam-diam -- kalau AI Agent nonaktif atau error,
// pelanggan tetap bisa menunggu admin manusia seperti biasa.
export async function pancingBalasanAi({ sessionId }) {
  try {
    const { data, error } = await supabase.functions.invoke("ai-live-chat", {
      body: { session_id: sessionId },
    });
    if (error) {
      console.warn("AI Agent tidak membalas:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn("AI Agent tidak membalas:", err);
    return null;
  }
}

// Ambil riwayat chat satu pelanggan (pengganti ambil_chat.php)
export async function ambilRiwayatChat({ userId, sessionId }) {
  let query = supabase
    .from("live_chat")
    .select("*")
    .eq("user_id", userId)
    .order("id", { ascending: true });

  if (sessionId) query = query.eq("session_id", sessionId);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

// Dengarkan pesan baru secara realtime untuk satu pelanggan
// (dipakai di widget chat pelanggan)
export function dengarkanChatCustomer(userId, onNewMessage) {
  const channel = supabase
    .channel(`live_chat_user_${userId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "live_chat",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}

// Dengarkan SEMUA pesan baru dari semua pelanggan
// (dipakai di dashboard admin/live_chat.php versi baru)
export function dengarkanChatSemuaAdmin(onNewMessage) {
  const channel = supabase
    .channel("live_chat_admin_dashboard")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_chat" },
      (payload) => onNewMessage(payload.new)
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}
