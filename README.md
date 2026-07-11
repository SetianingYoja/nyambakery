# NyamBakery — Migrasi PHP → JS (GitHub Pages + Supabase)

## Kenapa arsitektur ini?

GitHub Pages **hanya hosting statis** — tidak bisa menjalankan PHP, Node, atau
MySQL sendiri. Jadi "pindah ke JS lalu hosting di GitHub" perlu backend
terpisah yang gratis dan tidak akan diblokir seperti n8n di InfinityFree.

**Supabase** dipakai sebagai pengganti MySQL + PHP + n8n sekaligus:

| Fitur lama | Pengganti |
|---|---|
| MySQL (`nyambakery.sql`) | Supabase Postgres (`supabase/schema.sql`) |
| Session login PHP | Supabase Auth |
| Folder `uploads/` | Supabase Storage |
| Live chat lewat webhook n8n | Supabase Realtime (langsung dari browser, tanpa server perantara) |

Karena semua panggilan langsung dari browser ke Supabase lewat HTTPS/WebSocket,
tidak ada lagi request ke server pihak ketiga yang bisa diblokir oleh hosting.

## Struktur folder

```
nyambakery-js/
├── supabase/
│   └── schema.sql          # skema database (import ini ke Supabase)
└── public/                 # ini yang di-deploy ke GitHub Pages
    ├── index.html           # contoh halaman toko + widget live chat
    ├── admin/
    │   └── live-chat.html   # contoh dashboard live chat admin (realtime)
    ├── css/                 # CSS lama kamu, dipakai ulang
    └── js/
        ├── supabaseClient.js
        ├── auth.js
        └── liveChat.js
```

## Langkah setup

### 1. Buat project Supabase (gratis)
1. Daftar di https://supabase.com → **New project**.
2. Buka **SQL Editor** → tempel isi `supabase/schema.sql` → **Run**.
   Ini akan membuat 24 tabel + tabel `live_chat` + aturan keamanan (RLS).
3. Buka **Project Settings → API**, salin `Project URL` dan `anon public key`.
4. Tempel keduanya ke `public/js/supabaseClient.js`.

### 2. Migrasi data lama
- Password di dump lama (`paeko`, `editor123`, dst) **plaintext** — ini sebenarnya
  celah keamanan di versi lama. Jangan dipindah apa adanya.
- Buat ulang akun admin/customer lewat Supabase Auth (Authentication → Add user),
  lalu insert baris profil ke tabel `admin`/`users` dengan `id` yang sama
  dengan `id` user di Supabase Auth.
- Untuk data produk, kategori, dll: bisa import lewat Table Editor Supabase
  (opsi "Insert via spreadsheet") atau saya bantu buatkan script migrasi kalau
  kamu mau.
- Untuk gambar di folder `uploads/`: upload ke **Supabase Storage** (buat bucket
  `produk`, `ulasan`, `promo`, `banner`, `galeri`), lalu update kolom
  `thumbnail`/`gambar` supaya isinya URL publik dari Storage.

### 3. Jalankan lokal
Tidak perlu build tool — buka `public/index.html` langsung, atau pakai
Live Server / `npx serve public`.

### 4. Deploy ke GitHub Pages
1. Push folder `public/` ke repo GitHub.
2. Settings → Pages → Source: branch kamu, folder `/public` (atau `/` kalau
   `public/` dijadikan root repo).
3. Selesai — tidak ada server yang perlu dijalankan sama sekali.

## Live chat — cara kerja barunya

- `kirimChatCustomer()` → insert langsung ke tabel `live_chat` di Supabase.
- `dengarkanChatCustomer()` / `dengarkanChatSemuaAdmin()` → subscribe ke
  Supabase Realtime, jadi pesan baru langsung muncul tanpa refresh, tanpa
  polling, dan tanpa webhook n8n.
- Kalau kamu masih mau fitur **balasan otomatis AI** (peran n8n sebelumnya),
  itu bisa ditambahkan lagi nanti lewat **Supabase Edge Function** yang
  dipanggil trigger database saat ada pesan baru — jauh lebih stabil daripada
  webhook eksternal karena jalan di infrastruktur Supabase sendiri, bukan
  dari hosting kamu. Bilang saja kalau mau saya siapkan ini.

## Status migrasi & langkah selanjutnya

Yang sudah dibuatkan di sini:
- ✅ Skema database lengkap (24 tabel + live_chat) dengan Row Level Security
- ✅ Trigger otomatis pengurang stok saat pesanan dibuat
- ✅ Modul & halaman autentikasi (`login.html`, `register.html`)
- ✅ Live chat pelanggan + dashboard admin (fitur yang jadi masalah utama)
- ✅ Katalog produk dengan filter kategori/harga/pencarian (`katalog.html`)
- ✅ Halaman detail produk: varian, galeri, ulasan (`detail-produk.html`)
- ✅ Keranjang belanja berbasis database (`cart.html`) — beda dari versi lama
  yang pakai PHP session, sekarang keranjang ikut akun di device manapun
- ✅ Checkout: alamat, voucher, metode pembayaran (`checkout.html`)
- ✅ Riwayat pesanan pelanggan (`pesanan-saya.html`)

Catatan penting soal checkout: karena RLS mencegah pelanggan mengubah tabel
`produk` secara langsung, pengurangan stok & penambahan `total_terjual`
dilakukan lewat trigger database (`trg_kurangi_stok` di `schema.sql`), bukan
dari kode JS. Ini juga membuatnya lebih aman dari race condition dibanding
logika PHP lama.

Yang belum, dan bisa saya lanjutkan kalau kamu mau:
- Seluruh admin panel: kelola produk (CRUD + upload gambar ke Storage),
  kategori, pesanan masuk, laporan penjualan, promo, voucher, banner,
  cabang toko, kelola admin & role permission, ulasan
- Halaman profil pelanggan, wishlist, notifikasi
- Navbar/komponen bersama supaya tidak copy-paste (opsional, bisa dirapikan
  belakangan)

Kabari saja bagian mana yang mau dikerjakan duluan — biasanya paling masuk
akal lanjut ke admin panel produk & pesanan dulu, karena tanpa itu admin
tidak bisa menambah produk baru dari sisi baru ini.
