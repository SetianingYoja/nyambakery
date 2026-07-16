// =====================================================================
// ADMIN AI AGENT (service backend)
// -----------------------------------------------------------------------
// Service backend untuk membantu tugas admin: analisis data (laporan
// penjualan, produk terlaris), pencarian data (pesanan, pelanggan), dan
// pembuatan konten (draft promo) -- dengan memanggil fungsi backend
// (tools di aiAgentCore.ts / TOOLS_ADMIN) ke database saat diperlukan.
// Beda dari Customer AI (ai-live-chat): fungsi ini TIDAK menyimpan apapun
// ke tabel live_chat.
//
// Fungsi ini stateless di server: riwayat percakapan disimpan di memori
// browser admin (lihat docs/js/adminAiAssistant.js) dan dikirim ulang
// setiap kali memanggil fungsi ini, bukan disimpan di database.
// =====================================================================
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { TOOLS_ADMIN, jalankanAiAgent } from "../_shared/aiAgentCore.ts";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { supabase, supabaseAdmin, userClaims } = ctx;
    const userId = userClaims?.sub ?? userClaims?.id;

    if (!userId) {
      return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
    }

    // Pastikan yang memanggil benar-benar admin (RLS: "admin sees self").
    const { data: adminRow } = await supabase
      .from("admin")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (!adminRow) {
      return Response.json({ error: "Hanya admin yang boleh memakai asisten ini." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const pesan: string | undefined = body?.pesan;
    const riwayat = Array.isArray(body?.riwayat) ? body.riwayat : [];

    if (!pesan || typeof pesan !== "string") {
      return Response.json({ error: "Field 'pesan' wajib diisi." }, { status: 400 });
    }

    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      return Response.json(
        { error: "GEMINI_API_KEY belum diset. Jalankan: supabase secrets set GEMINI_API_KEY=xxx" },
        { status: 500 }
      );
    }

    const systemPrompt = [
      "Kamu adalah asisten AI internal untuk admin toko roti online NyamBakery.",
      "Bantu admin mencari data penjualan, pesanan, pelanggan, dan produk terlaris, serta membuat draft promo.",
      "Jawab ringkas dan faktual berdasarkan hasil tool saja, gunakan format Rupiah yang mudah dibaca (mis. Rp150.000).",
      "buat_draft_promo hanya membuat draft NONAKTIF -- selalu ingatkan admin untuk mengecek & mengaktifkannya manual di halaman Promo.",
    ].join("\n");

    const jawaban = await jalankanAiAgent({
      supabase: supabaseAdmin,
      geminiApiKey,
      systemPrompt,
      riwayat,
      pesanBaru: pesan,
      tools: TOOLS_ADMIN,
    });

    return Response.json({ jawaban });
  }),
};
