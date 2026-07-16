// =====================================================================
// AI LIVE CHAT
// Dipanggil dari browser pelanggan (docs/js/liveChat.js) tepat setelah
// pesan pelanggan tersimpan di tabel live_chat. Fungsi ini yang membuat
// AI Agent otomatis membalas -- pengganti peran n8n yang diblokir
// InfinityFree dulu.
//
// Auth mode "user": dipanggil pakai JWT pelanggan yang sedang login
// (lewat supabase.functions.invoke, otomatis kirim access_token-nya).
// ctx.supabase  -> scoped ke RLS pelanggan itu sendiri (aman untuk baca
//                  riwayat chat miliknya).
// ctx.supabaseAdmin -> dipakai untuk insert balasan AI (pengirim: "ai")
//                  karena RLS live_chat hanya izinkan pengirim customer
//                  atau admin yang insert langsung.
// =====================================================================
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { TOOLS_CUSTOMER, jalankanAiAgent } from "../_shared/aiAgentCore.ts";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { supabase, supabaseAdmin, userClaims } = ctx;
    const userId = userClaims?.sub ?? userClaims?.id;

    if (!userId) {
      return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId: string = body?.session_id ?? "";

    // 1. Cek pengaturan AI Agent -- kalau nonaktif, diam saja.
    const { data: settings } = await supabaseAdmin
      .from("ai_agent_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings?.aktif) {
      return Response.json({ dibalas: false, alasan: "AI Agent sedang nonaktif" });
    }

    // 2. Ambil riwayat chat sesi ini (RLS: pelanggan cuma bisa baca chat miliknya sendiri).
    let query = supabase
      .from("live_chat")
      .select("pengirim, pesan, status")
      .eq("user_id", userId)
      .order("id", { ascending: true });
    if (sessionId) query = query.eq("session_id", sessionId);

    const { data: riwayatChat, error: errRiwayat } = await query;
    if (errRiwayat) {
      return Response.json({ error: errRiwayat.message }, { status: 500 });
    }
    if (!riwayatChat || riwayatChat.length === 0) {
      return Response.json({ dibalas: false, alasan: "Belum ada pesan di sesi ini" });
    }

    // 3. Kalau admin sudah pernah ikut membalas di sesi ini, AI berhenti
    //    permanen untuk sesi tsb -- biar tidak tabrakan sama admin manusia.
    const adminSudahMembalas = riwayatChat.some((p) => p.pengirim === "admin");
    if (adminSudahMembalas) {
      return Response.json({ dibalas: false, alasan: "Admin sudah ikut membalas sesi ini" });
    }

    // 4. Pesan terakhir harus dari customer (kalau AI atau admin, tidak perlu balas lagi).
    const pesanTerakhir = riwayatChat[riwayatChat.length - 1];
    if (pesanTerakhir.pengirim !== "customer") {
      return Response.json({ dibalas: false, alasan: "Pesan terakhir bukan dari customer" });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY belum diset. Jalankan: supabase secrets set GEMINI_API_KEY=xxx" },
        { status: 500 }
      );
    }

    // 5. Susun system prompt dari pengaturan admin.
    const systemPrompt = [
      `Kamu adalah "${settings.nama_agent || "Asisten Toko"}", asisten AI untuk toko roti online NyamBakery.`,
      settings.sapaan_pembuka ? `Referensi gaya sapaan: "${settings.sapaan_pembuka}"` : "",
      "Selalu balas dalam Bahasa Indonesia, singkat, ramah, dan HANYA berdasarkan data hasil tool.",
      "Jangan pernah mengarang harga, stok, atau promo yang tidak muncul dari hasil tool.",
      "Kalau pertanyaan di luar topik toko, atau pelanggan minta bicara dengan manusia, arahkan untuk menunggu admin.",
      settings.instruksi_tambahan ? `Instruksi tambahan dari admin toko: ${settings.instruksi_tambahan}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    // 6. Riwayat percakapan (selain pesan terakhir, yang dikirim terpisah ke jalankanAiAgent).
    const riwayatGemini = riwayatChat.slice(0, -1).map((p) => ({
      role: p.pengirim === "customer" ? "user" : "model",
      parts: [{ text: p.pesan }],
    }));

    const jawabanAi = await jalankanAiAgent({
      supabase: supabaseAdmin,
      geminiApiKey,
      systemPrompt,
      riwayat: riwayatGemini,
      pesanBaru: pesanTerakhir.pesan,
      tools: TOOLS_CUSTOMER,
    });

    // 7. Simpan balasan AI. Pakai supabaseAdmin karena RLS live_chat cuma
    //    izinkan insert pengirim "customer" (atau admin) langsung dari client.
    const { data: pesanTersimpan, error: errInsert } = await supabaseAdmin
      .from("live_chat")
      .insert({
        user_id: userId,
        session_id: sessionId,
        pengirim: "ai",
        pesan: jawabanAi,
        status: "normal",
      })
      .select()
      .single();

    if (errInsert) {
      return Response.json({ error: errInsert.message }, { status: 500 });
    }

    return Response.json({ dibalas: true, balasan: pesanTersimpan });
  }),
};
