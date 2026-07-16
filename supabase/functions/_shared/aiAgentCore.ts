// =====================================================================
// AI AGENT CORE
// Ini "otak" service AI Agent-nya: mengelola daftar tools (fungsi yang
// bisa dipanggil AI untuk mengambil data / menjalankan aksi di database),
// menjalankan tool tersebut, dan mengelola agentic loop dengan Gemini
// (model boleh memanggil tool berkali-kali sebelum memberi jawaban akhir).
//
// Dipakai bersama oleh ai-live-chat (customer) dan ai-admin-assistant
// (admin) -- keduanya AI Agent yang sama, cuma beda daftar tools & prompt.
// =====================================================================

// ---------------------------------------------------------------------
// DEFINISI TOOLS
// Setiap tool: nama, deskripsi (dibaca AI untuk memutuskan kapan dipakai),
// dan skema parameter (format OpenAPI-like yang dipahami Gemini).
// ---------------------------------------------------------------------

export const toolCariProduk = {
  name: "cari_produk",
  description: "Mencari produk di katalog toko berdasarkan kata kunci nama produk. Kembalikan nama, harga, diskon, kategori, dan stok.",
  parameters: {
    type: "object",
    properties: {
      kata_kunci: { type: "string", description: "Kata kunci nama produk yang dicari, boleh kosong untuk semua produk." },
    },
  },
};

export const toolPromoAktif = {
  name: "ambil_promo_aktif",
  description: "Mengambil daftar promo yang sedang aktif saat ini di toko.",
  parameters: { type: "object", properties: {} },
};

export const toolVoucherAktif = {
  name: "ambil_voucher_aktif",
  description: "Mengambil daftar kode voucher yang sedang aktif beserta besaran diskonnya.",
  parameters: { type: "object", properties: {} },
};

export const toolInfoToko = {
  name: "info_toko",
  description: "Mengambil info toko: alamat cabang, jam operasional, nomor WhatsApp, dan kontak.",
  parameters: { type: "object", properties: {} },
};

export const toolLaporanPenjualan = {
  name: "laporan_penjualan",
  description: "Mengambil ringkasan penjualan (jumlah transaksi & total pendapatan) dalam rentang tanggal tertentu. Gunakan format tanggal YYYY-MM-DD.",
  parameters: {
    type: "object",
    properties: {
      dari_tanggal: { type: "string", description: "Tanggal mulai, format YYYY-MM-DD. Kosongkan untuk dari awal." },
      sampai_tanggal: { type: "string", description: "Tanggal akhir, format YYYY-MM-DD. Kosongkan untuk sampai sekarang." },
    },
  },
};

export const toolProdukTerlaris = {
  name: "produk_terlaris",
  description: "Mengambil daftar produk dengan penjualan terbanyak (total_terjual).",
  parameters: {
    type: "object",
    properties: {
      jumlah: { type: "number", description: "Berapa banyak produk teratas yang ingin ditampilkan, default 5." },
    },
  },
};

export const toolCariPesanan = {
  name: "cari_pesanan",
  description: "Mencari pesanan pelanggan berdasarkan nomor pesanan atau status pesanan (menunggu/diproses/dikirim/selesai/dibatalkan).",
  parameters: {
    type: "object",
    properties: {
      nomor_pesanan: { type: "string", description: "Nomor pesanan spesifik yang dicari, opsional." },
      status: { type: "string", description: "Filter berdasarkan status pesanan, opsional." },
    },
  },
};

export const toolCariPelanggan = {
  name: "cari_pelanggan",
  description: "Mencari data pelanggan berdasarkan nama atau email.",
  parameters: {
    type: "object",
    properties: {
      kata_kunci: { type: "string", description: "Nama atau email pelanggan yang dicari." },
    },
  },
};

export const toolBuatDraftPromo = {
  name: "buat_draft_promo",
  description: "Membuat DRAFT promo baru (berstatus nonaktif, tidak langsung tayang) berdasarkan permintaan admin. Admin harus mengaktifkannya manual di halaman Promo setelah dicek.",
  parameters: {
    type: "object",
    properties: {
      judul: { type: "string", description: "Judul promo." },
      deskripsi: { type: "string", description: "Deskripsi promo." },
      tanggal_mulai: { type: "string", description: "Format YYYY-MM-DD." },
      tanggal_selesai: { type: "string", description: "Format YYYY-MM-DD." },
    },
    required: ["judul", "tanggal_mulai", "tanggal_selesai"],
  },
};

export const TOOLS_CUSTOMER = [toolCariProduk, toolPromoAktif, toolVoucherAktif, toolInfoToko];
export const TOOLS_ADMIN = [
  toolCariProduk, toolPromoAktif, toolVoucherAktif, toolInfoToko,
  toolLaporanPenjualan, toolProdukTerlaris, toolCariPesanan, toolCariPelanggan, toolBuatDraftPromo,
];

// ---------------------------------------------------------------------
// EKSEKUSI TOOL
// Ini bagian yang benar-benar menyentuh database -- dipanggil setiap
// kali model AI meminta suatu tool dijalankan.
// ---------------------------------------------------------------------

export async function jalankanTool(namaTool: string, args: any, supabase: any) {
  switch (namaTool) {
    case "cari_produk": {
      let query = supabase.from("produk").select("nama_produk, harga, diskon, jumlah_stok, kategori_produk(nama_kategori)").eq("diarsipkan", false).limit(20);
      if (args?.kata_kunci) query = query.ilike("nama_produk", `%${args.kata_kunci}%`);
      const { data, error } = await query;
      return error ? { error: error.message } : { produk: data };
    }

    case "ambil_promo_aktif": {
      const { data, error } = await supabase.from("promo").select("judul, deskripsi, tanggal_mulai, tanggal_selesai").eq("aktif", true);
      return error ? { error: error.message } : { promo: data };
    }

    case "ambil_voucher_aktif": {
      const { data, error } = await supabase.from("voucher").select("kode, nama_voucher, tipe_diskon, nilai_diskon, minimal_belanja").eq("aktif", true);
      return error ? { error: error.message } : { voucher: data };
    }

    case "info_toko": {
      const [{ data: cabang }, { data: kontak }] = await Promise.all([
        supabase.from("cabang_toko").select("nama_cabang, alamat, jam_operasional, whatsapp").eq("status_cabang", "aktif"),
        supabase.from("kontak_toko").select("*").limit(1).maybeSingle(),
      ]);
      return { cabang, kontak };
    }

    case "laporan_penjualan": {
      let query = supabase.from("pesanan").select("total_bayar, created_at").neq("status_pesanan", "dibatalkan");
      if (args?.dari_tanggal) query = query.gte("created_at", args.dari_tanggal);
      if (args?.sampai_tanggal) query = query.lte("created_at", args.sampai_tanggal + "T23:59:59");
      const { data, error } = await query;
      if (error) return { error: error.message };
      const total = (data ?? []).reduce((sum: number, p: any) => sum + Number(p.total_bayar), 0);
      return { jumlah_transaksi: data?.length ?? 0, total_pendapatan: total };
    }

    case "produk_terlaris": {
      const { data, error } = await supabase.from("produk").select("nama_produk, total_terjual").order("total_terjual", { ascending: false }).limit(args?.jumlah ?? 5);
      return error ? { error: error.message } : { produk_terlaris: data };
    }

    case "cari_pesanan": {
      let query = supabase.from("pesanan").select("nomor_pesanan, status_pesanan, total_bayar, created_at, users(nama_lengkap)").order("created_at", { ascending: false }).limit(20);
      if (args?.nomor_pesanan) query = query.eq("nomor_pesanan", args.nomor_pesanan);
      if (args?.status) query = query.eq("status_pesanan", args.status);
      const { data, error } = await query;
      return error ? { error: error.message } : { pesanan: data };
    }

    case "cari_pelanggan": {
      const { data, error } = await supabase
        .from("users")
        .select("nama_lengkap, username, email, no_hp")
        .or(`nama_lengkap.ilike.%${args?.kata_kunci ?? ""}%,email.ilike.%${args?.kata_kunci ?? ""}%`)
        .limit(20);
      return error ? { error: error.message } : { pelanggan: data };
    }

    case "buat_draft_promo": {
      const { data, error } = await supabase.from("promo").insert({
        judul: args.judul,
        deskripsi: args.deskripsi ?? "",
        tanggal_mulai: args.tanggal_mulai,
        tanggal_selesai: args.tanggal_selesai,
        aktif: false,
      }).select().single();
      return error ? { error: error.message } : { berhasil: true, promo_draft: data };
    }

    default:
      return { error: `Tool tidak dikenal: ${namaTool}` };
  }
}

// ---------------------------------------------------------------------
// AGENTIC LOOP
// Kirim pesan ke Gemini bersama daftar tools. Kalau model minta panggil
// tool, jalankan, kirim hasilnya balik ke model, ulangi sampai model
// akhirnya memberi jawaban teks (maksimal beberapa putaran untuk jaga2).
// ---------------------------------------------------------------------

export async function jalankanAiAgent({
  supabase,
  geminiApiKey,
  systemPrompt,
  riwayat,
  pesanBaru,
  tools,
  maxIterasi = 5,
}: {
  supabase: any;
  geminiApiKey: string;
  systemPrompt: string;
  riwayat: { role: string; parts: any[] }[];
  pesanBaru: string;
  tools: any[];
  maxIterasi?: number;
}) {
  const contents = [...riwayat, { role: "user", parts: [{ text: pesanBaru }] }];

  for (let i = 0; i < maxIterasi; i++) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          tools: [{ function_declarations: tools }],
        }),
      }
    );

    const hasil = await response.json();
    const kandidat = hasil.candidates?.[0]?.content;

    if (!kandidat) {
      return "Maaf, saya belum bisa menjawab itu sekarang.";
    }

    const bagianFunctionCall = kandidat.parts.filter((p: any) => p.functionCall);

    if (bagianFunctionCall.length > 0) {
      contents.push({ role: "model", parts: kandidat.parts });

      const hasilTool = await Promise.all(
        bagianFunctionCall.map(async (p: any) => {
          const hasilEksekusi = await jalankanTool(p.functionCall.name, p.functionCall.args, supabase);
          return { functionResponse: { name: p.functionCall.name, response: hasilEksekusi } };
        })
      );

      contents.push({ role: "user", parts: hasilTool });
      continue;
    }

    const teksJawaban = kandidat.parts.find((p: any) => p.text)?.text;
    if (teksJawaban) return teksJawaban;

    return "Maaf, saya belum bisa menjawab itu sekarang.";
  }

  return "Maaf, pertanyaan ini butuh terlalu banyak langkah untuk saya proses. Admin akan segera membantu.";
}