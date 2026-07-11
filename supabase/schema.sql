-- =====================================================================
-- NYAMBAKERY - Skema Postgres untuk Supabase
-- Dikonversi dari nyambakery.sql (MySQL/phpMyAdmin dump)
-- =====================================================================
-- Catatan konversi:
--   int AUTO_INCREMENT      -> integer generated always as identity
--   tinyint(1)               -> boolean
--   enum(...)                -> text + check constraint
--   timestamp/datetime       -> timestamptz
--   decimal(12,2)            -> numeric(12,2)
--   password plaintext lama  -> TIDAK dimigrasikan (lihat README, pakai Supabase Auth)
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- USERS (pelanggan) & ADMIN
-- Keduanya sekarang terhubung ke auth.users milik Supabase Auth.
-- id di tabel ini = auth.users.id (uuid), bukan lagi integer auto increment.
-- ---------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  nama_lengkap varchar(100) not null,
  username varchar(50) unique not null,
  email varchar(100) unique not null,
  no_hp varchar(20),
  foto_profil varchar(255),
  role text default 'customer' check (role in ('admin','customer')),
  created_at timestamptz default now()
);

create table public.admin (
  id uuid primary key references auth.users (id) on delete cascade,
  username varchar(50) unique not null,
  no_wa varchar(20),
  nama_lengkap varchar(100),
  email varchar(100),
  created_at timestamptz default now(),
  role text default 'viewer' check (role in ('super_admin','editor','viewer')),
  status text default 'Aktif' check (status in ('Aktif','Nonaktif'))
);

create table public.admin_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.admin (id),
  aktivitas varchar(255),
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- KATALOG
-- ---------------------------------------------------------------------

create table public.kategori_produk (
  id bigint generated always as identity primary key,
  nama_kategori varchar(100) not null,
  slug varchar(100) unique,
  icon_url varchar(255),
  created_at timestamptz default now()
);

create table public.produk (
  id bigint generated always as identity primary key,
  kategori_id bigint references public.kategori_produk (id) on delete set null,
  nama_produk varchar(150) not null,
  slug varchar(150) unique,
  deskripsi text,
  harga numeric(12,2) not null,
  berat integer default 0,
  thumbnail varchar(255),
  created_at timestamptz default now(),
  jenis_kue varchar(100),
  sku varchar(100),
  jumlah_stok integer default 0,
  total_terjual integer default 0,
  halal text default 'Ya' check (halal in ('Ya','Tidak')),
  best_seller boolean default false,
  produk_baru boolean default true,
  satuan_berat varchar(10) default 'gram',
  diskon integer default 0,
  diarsipkan boolean default false
);

create table public.galeri_produk (
  id bigint generated always as identity primary key,
  produk_id bigint not null references public.produk (id) on delete cascade,
  gambar varchar(255) not null
);

create table public.varian_produk (
  id bigint generated always as identity primary key,
  produk_id bigint not null references public.produk (id) on delete cascade,
  nama_varian varchar(100) not null,
  harga_tambahan numeric(12,2) default 0,
  stok integer default 0
);

create table public.review_produk (
  id bigint generated always as identity primary key,
  produk_id bigint not null references public.produk (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  rating integer,
  komentar text,
  created_at timestamptz default now()
);

create table public.wishlist (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  produk_id bigint not null references public.produk (id) on delete cascade,
  created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- KERANJANG & CHECKOUT
-- ---------------------------------------------------------------------

create table public.keranjang (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz default now()
);

create table public.item_keranjang (
  id bigint generated always as identity primary key,
  keranjang_id bigint not null references public.keranjang (id) on delete cascade,
  produk_id bigint not null references public.produk (id) on delete cascade,
  varian_id bigint references public.varian_produk (id) on delete set null,
  qty integer default 1
);

create table public.alamat_pengiriman (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  penerima varchar(100),
  no_hp varchar(20),
  provinsi varchar(100),
  kota varchar(100),
  kecamatan varchar(100),
  kode_pos varchar(10),
  alamat_lengkap text,
  is_default boolean default false
);

create table public.pesanan (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id),
  alamat_id bigint not null references public.alamat_pengiriman (id),
  nomor_pesanan varchar(50) unique,
  subtotal numeric(12,2),
  diskon numeric(12,2) default 0,
  ongkir numeric(12,2) default 0,
  total_bayar numeric(12,2),
  metode_pembayaran varchar(50),
  status_pesanan text default 'menunggu'
    check (status_pesanan in ('menunggu','diproses','dikirim','selesai','dibatalkan')),
  catatan text,
  created_at timestamptz default now()
);

create table public.detail_pesanan (
  id bigint generated always as identity primary key,
  pesanan_id bigint not null references public.pesanan (id) on delete cascade,
  produk_id bigint not null references public.produk (id),
  varian_id bigint references public.varian_produk (id) on delete set null,
  harga numeric(12,2),
  qty integer,
  subtotal numeric(12,2)
);

create table public.pembayaran (
  id bigint generated always as identity primary key,
  pesanan_id bigint not null references public.pesanan (id) on delete cascade,
  metode varchar(50),
  nominal numeric(12,2),
  status text default 'pending' check (status in ('pending','berhasil','gagal')),
  bukti_pembayaran varchar(255),
  paid_at timestamptz
);

create table public.voucher (
  id bigint generated always as identity primary key,
  kode varchar(50) unique,
  nama_voucher varchar(100),
  tipe_diskon text check (tipe_diskon in ('persen','nominal')),
  nilai_diskon numeric(12,2),
  minimal_belanja numeric(12,2),
  tanggal_mulai date,
  tanggal_selesai date,
  aktif boolean default true
);

-- ---------------------------------------------------------------------
-- KONTEN TOKO (banner, promo, cabang, kontak, sosmed)
-- ---------------------------------------------------------------------

create table public.banner (
  id bigint generated always as identity primary key,
  judul varchar(150),
  sub_judul text,
  gambar varchar(255),
  tombol_text varchar(50),
  tombol_link varchar(255),
  aktif boolean default true
);

create table public.promo (
  id bigint generated always as identity primary key,
  judul varchar(100),
  deskripsi text,
  gambar varchar(255),
  tanggal_mulai date,
  tanggal_selesai date,
  aktif boolean default true,
  urutan integer default 0,
  tampil_katalog boolean default true,
  status text default 'Aktif' check (status in ('Aktif','Nonaktif')),
  produk_id bigint references public.produk (id) on delete set null
);

create table public.cabang_toko (
  id bigint generated always as identity primary key,
  nama_cabang varchar(100),
  alamat text,
  telepon varchar(20),
  email varchar(100),
  maps_link text,
  jam_operasional varchar(100),
  status_cabang text default 'aktif' check (status_cabang in ('aktif','nonaktif')),
  whatsapp varchar(20),
  default_cabang boolean default false
);

create table public.kontak_toko (
  id bigint generated always as identity primary key,
  nama_toko varchar(100),
  email varchar(100),
  telepon varchar(20),
  alamat text,
  maps_embed text,
  instagram varchar(255),
  tiktok varchar(255),
  whatsapp varchar(255)
);

create table public.sosial_media (
  id bigint generated always as identity primary key,
  cabang_id bigint references public.cabang_toko (id) on delete set null,
  platform varchar(50),
  link text,
  status text default 'Aktif' check (status in ('Aktif','Nonaktif')),
  icon varchar(50)
);

-- ---------------------------------------------------------------------
-- NOTIFIKASI & ROLE PERMISSION
-- ---------------------------------------------------------------------

create table public.notifikasi (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  judul varchar(100),
  pesan text,
  dibaca boolean default false,
  created_at timestamptz default now()
);

create table public.notifikasi_admin (
  id bigint generated always as identity primary key,
  judul varchar(100),
  pesan text,
  status text default 'Belum Dibaca' check (status in ('Belum Dibaca','Dibaca')),
  created_at timestamptz default now()
);

create table public.role_permission (
  id bigint generated always as identity primary key,
  role_name varchar(50),
  dashboard boolean default false,
  produk boolean default false,
  kategori boolean default false,
  cabang boolean default false,
  promo boolean default false,
  sosial_media boolean default false,
  admin boolean default false,
  role_menu boolean default false,
  banner boolean default false,
  pesanan boolean default false,
  produk_view boolean default false,
  produk_tambah boolean default false,
  produk_edit boolean default false,
  produk_hapus boolean default false,
  admin_view boolean default false,
  admin_tambah boolean default false,
  admin_edit boolean default false,
  admin_hapus boolean default false
);

insert into public.role_permission
  (role_name, dashboard, produk, kategori, cabang, promo, sosial_media, admin, role_menu, banner, pesanan,
   produk_view, produk_tambah, produk_edit, produk_hapus, admin_view, admin_tambah, admin_edit, admin_hapus)
values
  ('super_admin', true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true, true),
  ('editor', true, true, true, true, true, true, false, false, false, false, true, true, true, false, false, false, false, false),
  ('viewer', true, false, false, false, false, false, false, false, false, false, true, false, false, false, false, false, false, false);

-- ---------------------------------------------------------------------
-- LIVE CHAT
-- (tabel ini dipakai oleh kode PHP lama tapi TIDAK ada di dump SQL kamu,
--  jadi disusun ulang dari cara kolomnya dipakai di simpan_live_chat.php,
--  ambil_chat.php, dan admin/live_chat.php)
-- ---------------------------------------------------------------------

create table public.live_chat (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  session_id varchar(100) not null default '',
  pengirim text not null check (pengirim in ('customer','admin','ai')),
  pesan text not null,
  status text not null default 'menunggu_admin'
    check (status in ('menunggu_admin','normal','ditangani_admin')),
  created_at timestamptz default now()
);

create index idx_live_chat_user on public.live_chat (user_id);
create index idx_live_chat_session on public.live_chat (user_id, session_id);

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================

alter table public.users enable row level security;
alter table public.admin enable row level security;
alter table public.produk enable row level security;
alter table public.kategori_produk enable row level security;
alter table public.galeri_produk enable row level security;
alter table public.varian_produk enable row level security;
alter table public.review_produk enable row level security;
alter table public.wishlist enable row level security;
alter table public.keranjang enable row level security;
alter table public.item_keranjang enable row level security;
alter table public.alamat_pengiriman enable row level security;
alter table public.pesanan enable row level security;
alter table public.detail_pesanan enable row level security;
alter table public.pembayaran enable row level security;
alter table public.voucher enable row level security;
alter table public.banner enable row level security;
alter table public.promo enable row level security;
alter table public.cabang_toko enable row level security;
alter table public.kontak_toko enable row level security;
alter table public.sosial_media enable row level security;
alter table public.notifikasi enable row level security;
alter table public.notifikasi_admin enable row level security;
alter table public.role_permission enable row level security;
alter table public.live_chat enable row level security;

-- Helper: cek apakah user yang sedang login adalah admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (select 1 from public.admin where id = auth.uid());
$$;

-- Publik boleh baca konten katalog & toko
create policy "public read produk" on public.produk for select using (true);
create policy "public read kategori" on public.kategori_produk for select using (true);
create policy "public read galeri" on public.galeri_produk for select using (true);
create policy "public read varian" on public.varian_produk for select using (true);
create policy "public read review" on public.review_produk for select using (true);
create policy "public read banner" on public.banner for select using (true);
create policy "public read promo" on public.promo for select using (true);
create policy "public read cabang" on public.cabang_toko for select using (true);
create policy "public read kontak" on public.kontak_toko for select using (true);
create policy "public read sosmed" on public.sosial_media for select using (true);

-- Hanya admin yang boleh ubah konten katalog & toko
create policy "admin write produk" on public.produk for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write kategori" on public.kategori_produk for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write galeri" on public.galeri_produk for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write varian" on public.varian_produk for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write banner" on public.banner for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write promo" on public.promo for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write cabang" on public.cabang_toko for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write kontak" on public.kontak_toko for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write sosmed" on public.sosial_media for all using (public.is_admin()) with check (public.is_admin());
create policy "admin write voucher" on public.voucher for all using (public.is_admin()) with check (public.is_admin());
create policy "public read voucher aktif" on public.voucher for select using (aktif = true);
create policy "admin all role_permission" on public.role_permission for all using (public.is_admin()) with check (public.is_admin());
create policy "admin manage admin" on public.admin for all using (public.is_admin()) with check (public.is_admin());
create policy "admin sees self" on public.admin for select using (id = auth.uid());

-- Data milik sendiri (customer)
create policy "user manage own row" on public.users for select using (id = auth.uid() or public.is_admin());
create policy "user update own row" on public.users for update using (id = auth.uid());
create policy "user insert own row" on public.users for insert with check (id = auth.uid());

create policy "user manage own review" on public.review_produk for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());
create policy "user manage own wishlist" on public.wishlist for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user manage own cart" on public.keranjang for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user manage own cart items" on public.item_keranjang for all using (
  exists (select 1 from public.keranjang k where k.id = keranjang_id and k.user_id = auth.uid())
);
create policy "user manage own address" on public.alamat_pengiriman for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "user read own orders" on public.pesanan for select using (user_id = auth.uid() or public.is_admin());
create policy "user create own orders" on public.pesanan for insert with check (user_id = auth.uid());
create policy "admin update orders" on public.pesanan for update using (public.is_admin());

create policy "user read own order details" on public.detail_pesanan for select using (
  exists (select 1 from public.pesanan p where p.id = pesanan_id and (p.user_id = auth.uid() or public.is_admin()))
);
create policy "user insert own order details" on public.detail_pesanan for insert with check (
  exists (select 1 from public.pesanan p where p.id = pesanan_id and p.user_id = auth.uid())
);

create policy "user read own payment" on public.pembayaran for select using (
  exists (select 1 from public.pesanan p where p.id = pesanan_id and (p.user_id = auth.uid() or public.is_admin()))
);
create policy "admin manage payment" on public.pembayaran for all using (public.is_admin()) with check (public.is_admin());

create policy "user read own notif" on public.notifikasi for select using (user_id = auth.uid());
create policy "admin manage notif admin" on public.notifikasi_admin for all using (public.is_admin()) with check (public.is_admin());

-- Live chat: customer lihat/isi chat miliknya, admin lihat & balas semua
create policy "customer read own chat" on public.live_chat for select using (user_id = auth.uid() or public.is_admin());
create policy "customer send own chat" on public.live_chat for insert with check (
  (user_id = auth.uid() and pengirim = 'customer') or public.is_admin()
);
create policy "admin update chat status" on public.live_chat for update using (public.is_admin());

-- =====================================================================
-- TRIGGER: kurangi stok & tambah total_terjual otomatis saat ada
-- detail_pesanan baru (pengganti logika pengurangan stok yang tadinya
-- ada di checkout.php). security definer supaya bisa jalan meski
-- pelanggan sendiri tidak punya izin RLS untuk update tabel produk.
-- =====================================================================
create or replace function public.kurangi_stok_produk()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.produk
  set jumlah_stok = greatest(jumlah_stok - new.qty, 0),
      total_terjual = total_terjual + new.qty
  where id = new.produk_id;

  if new.varian_id is not null then
    update public.varian_produk
    set stok = greatest(stok - new.qty, 0)
    where id = new.varian_id;
  end if;

  return new;
end;
$$;

create trigger trg_kurangi_stok
  after insert on public.detail_pesanan
  for each row execute function public.kurangi_stok_produk();

-- =====================================================================
-- REALTIME
-- Aktifkan replication untuk tabel live_chat supaya bisa dipakai
-- Supabase Realtime (pengganti n8n untuk live chat).
-- =====================================================================
alter publication supabase_realtime add table public.live_chat;
