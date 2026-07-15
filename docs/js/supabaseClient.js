// =====================================================================
// Konfigurasi koneksi Supabase.
// Ganti dua nilai di bawah dengan punya kamu sendiri:
// Project Settings -> API -> Project URL & anon public key.
// Kedua nilai ini AMAN untuk taruh di frontend (GitHub Pages),
// karena akses data sebenarnya diatur oleh Row Level Security (RLS)
// yang sudah disiapkan di supabase/schema.sql.
// =====================================================================
const SUPABASE_URL = "https://qxvdkieiuojdkdwrfsxv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4dmRraWVpdW9qZGtkd3Jmc3h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1OTUxODIsImV4cCI6MjA5NzE3MTE4Mn0.w5Nt0UrUdWxbSlk6r-3uJEK-Unke_iVYHaZdNWRdAJ0";

// supabase-js dimuat lewat CDN di setiap HTML (lihat index.html)
export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
