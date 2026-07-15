// Edge Function: AI Agent untuk live chat NyamBakery
// Dipanggil otomatis lewat Database Webhook setiap ada pesan baru dari customer
 
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET")!;
 
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
 
Deno.serve(async (req) => {
  try {
    // Verifikasi request ini benar dari webhook Supabase kita sendiri, bukan orang luar
    const secretHeader = req.headers.get("x-webhook-secret");
    if (secretHeader !== WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }
 
    const payload = await req.json();
    const pesanBaru = payload.record;
 
    // Cuma proses kalau ini pesan dari customer (bukan dari admin/AI sendiri, hindari loop)
    if (!pesanBaru || pesanBaru.pengirim !== "customer") {
      return new Response("skip", { status: 200 });
    }
 
    // Cek pengaturan AI aktif atau tidak
    const { data: settings } = await supabase
      .from("ai_agent_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
 
    if (!settings || !settings.aktif) {
      return new Response("AI nonaktif", { status: 200 });
    }
 
    // Kalau admin sudah pernah balas di sesi chat ini, jangan ganggu -- serahkan ke admin
    const { data: pesanAdmin } = await supabase
      .from("live_chat")
      .select("id")
      .eq("user_id", pesanBaru.user_id)
      .eq("session_id", pesanBaru.session_id)
      .eq("pengirim", "admin")
      .limit(1)
      .maybeSingle();
 
    if (pesanAdmin) {
      return new Response("admin sudah menangani", { status: 200 });
    }
 
    // Ambil konteks data asli dari toko untuk dijadikan pengetahuan AI
    const [{ data: produk }, { data: promo }, { data: cabang }, { data: kontak }] = await Promise.all([
      supabase.from("produk").select("nama_produk, harga, diskon, kategori_produk(nama_kategori)").eq("diarsipkan", false).limit(50),
      supabase.from("promo").select("judul, deskripsi, tanggal_mulai, tanggal_selesai").eq("aktif", true),
      supabase.from("cabang_toko").select("nama_cabang, alamat, jam_operasional, whatsapp").eq("status_cabang", "aktif"),
      supabase.from("kontak_toko").select("*").limit(1).maybeSingle(),
    ]);
 
    // Ambil riwayat chat di sesi ini supaya AI paham konteks percakapan
    const { data: riwayat } = await supabase
      .from("live_chat")
      .select("pengirim, pesan")
      .eq("user_id", pesanBaru.user_id)
      .eq("session_id", pesanBaru.session_id)
      .order("id", { ascending: true })
      .limit(20);
 
    const daftarProduk = (produk ?? [])
      .map((p: any) => `- ${p.nama_produk} (${p.kategori_produk?.nama_kategori ?? "-"}): Rp ${Number(p.harga).toLocaleString("id-ID")}${p.diskon ? ` (diskon ${p.diskon}%)` : ""}`)
      .join("\n");
 
    const daftarPromo = (promo ?? []).length
      ? (promo ?? []).map((p: any) => `- ${p.judul}: ${p.deskripsi ?? ""} (berlaku ${p.tanggal_mulai} s/d ${p.tanggal_selesai})`).join("\n")
      : "Tidak ada promo aktif saat ini.";
 
    const infoCabang = (cabang ?? [])
      .map((c: any) => `- ${c.nama_cabang}: ${c.alamat}, jam operasional ${c.jam_operasional ?? "-"}`)
      .join("\n");
 
    const systemPrompt = `Kamu adalah "${settings.nama_agent}", asisten AI untuk toko roti online NyamBakery.
Jawab pertanyaan pelanggan dengan ramah, singkat, dan dalam Bahasa Indonesia.
Gunakan HANYA data di bawah ini sebagai sumber kebenaran, jangan mengarang produk/harga/promo yang tidak ada di daftar.
Kalau ditanya hal di luar topik toko (menu, harga, promo, jam buka, cara pesan), atau kalau pelanggan minta bicara dengan manusia/komplain serius, jawab dengan sopan bahwa admin manusia akan segera membantu.
 
DAFTAR PRODUK AKTIF:
${daftarProduk || "Belum ada produk."}
 
PROMO AKTIF:
${daftarPromo}
 
INFO CABANG:
${infoCabang || "-"}
 
INFO KONTAK: ${kontak?.telepon ?? "-"}, WhatsApp toko: ${cabang?.[0]?.whatsapp ?? "-"}
 
${settings.instruksi_tambahan ? `INSTRUKSI TAMBAHAN DARI ADMIN:\n${settings.instruksi_tambahan}` : ""}`;
 
    const messages = (riwayat ?? []).map((r: any) => ({
      role: r.pengirim === "customer" ? "user" : "assistant",
      content: r.pesan,
    }));
 
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    });
 
    const hasil = await response.json();
    const balasan = hasil.content?.[0]?.text ?? "Maaf, saya belum bisa menjawab itu sekarang. Admin kami akan segera membantu.";
 
    await supabase.from("live_chat").insert({
      user_id: pesanBaru.user_id,
      session_id: pesanBaru.session_id,
      pengirim: "ai",
      pesan: balasan,
      status: "normal",
    });
 
    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response("error: " + err.message, { status: 500 });
  }
});