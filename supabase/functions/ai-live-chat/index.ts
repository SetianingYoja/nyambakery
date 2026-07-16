// =====================================================================
// CUSTOMER AI AGENT (service backend)
// -----------------------------------------------------------------------
// Ini BUKAN chatbot dengan nama/kepribadian yang bisa diatur admin --
// ini adalah service backend yang menjembatani 3 hal:
//   1. Aplikasi (browser pelanggan, lewat docs/js/liveChat.js)
//   2. Database (Supabase Postgres, lewat aiAgentCore.ts / TOOLS_CUSTOMER)
//   3. Model AI (Gemini, lewat jalankanAiAgent -- agentic tool-calling loop)
//
// Dipanggil dari browser pelanggan (docs/js/liveChat.js) tepat setelah
// pesan pelanggan tersimpan di tabel live_chat. Pengganti peran n8n yang
// dulu diblokir InfinityFree.
//
// Auth mode "user": dipanggil pakai JWT pelanggan yang sedang login
// (lewat supabase.functions.invoke, otomatis kirim access_token-nya).
// ctx.supabase       -> scoped ke RLS pelanggan itu sendiri (aman untuk
//                       baca riwayat chat miliknya).
// ctx.supabaseAdmin  -> dipakai untuk insert balasan AI (pengirim: "ai")
//                       dan untuk tool eksekusi ambil data toko, karena
//                       RLS live_chat hanya izinkan insert dari customer
//                       atau admin secara langsung.
// =====================================================================
import "jsr:@supabase/functions-js@^2/edge-runtime.d.ts";
import { withSupabase } from "npm:@supabase/server@^1";
import { TOOLS_CUSTOMER, jalankanAiAgent } from "../_shared/aiAgentCore.ts";

// Instruksi dasar service ini -- bagian dari kode, bukan data yang
// diatur admin lewat UI.
const SYSTEM_PROMPT = [
  "Kamu adalah layanan asisten toko roti online NyamBakery.",
  "Selalu balas dalam Bahasa Indonesia, singkat, ramah, dan HANYA berdasarkan data hasil tool.",
  "Jangan pernah mengarang harga, stok, atau promo yang tidak muncul dari hasil tool.",
  "Kalau pertanyaan di luar topik toko, atau pelanggan minta bicara dengan manusia, arahkan untuk menunggu admin.",
].join("\n");

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { supabase, supabaseAdmin, userClaims } = ctx;
    const userId = userClaims?.sub ?? userClaims?.id;

    if (!userId) {
      return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId: string = body?.session_id ?? "";

    // 1. Ambil riwayat chat sesi ini (RLS: pelanggan cuma bisa baca chat miliknya sendiri).
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

    // 2. Kalau admin sudah pernah ikut membalas di sesi ini, service berhenti
    //    permanen untuk sesi tsb -- biar tidak tabrakan dengan admin manusia.
    const adminSudahMembalas = riwayatChat.some((p) => p.pengirim === "admin");
    if (adminSudahMembalas) {
      return Response.json({ dibalas: false, alasan: "Admin sudah ikut membalas sesi ini" });
    }

    // 3. Pesan terakhir harus dari customer (kalau AI sendiri, tidak perlu balas lagi).
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

    // 4. Riwayat percakapan (selain pesan terakhir, yang dikirim terpisah ke jalankanAiAgent).
    const riwayatGemini = riwayatChat.slice(0, -1).map((p) => ({
      role: p.pengirim === "customer" ? "user" : "model",
      parts: [{ text: p.pesan }],
    }));

    // 5. Jalankan agentic loop: model boleh manggil tools di aiAgentCore.ts
    //    (cari_produk, ambil_promo_aktif, dst) untuk ambil data asli dari DB
    //    sebelum menjawab.
    const jawabanAi = await jalankanAiAgent({
      supabase: supabaseAdmin,
      geminiApiKey,
      systemPrompt: SYSTEM_PROMPT,
      riwayat: riwayatGemini,
      pesanBaru: pesanTerakhir.pesan,
      tools: TOOLS_CUSTOMER,
    });

    // 6. Simpan balasan AI. Pakai supabaseAdmin karena RLS live_chat cuma
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
