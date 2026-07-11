// =====================================================================
// Pengganti login.php / register.php / logout_user.php
// Pakai Supabase Auth (menggantikan session PHP + password plaintext lama)
// =====================================================================
import { supabase } from "./supabaseClient.js";

// --- Daftar akun pelanggan baru ---
export async function registerCustomer({ email, password, nama_lengkap, username, no_hp }) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  const userId = data.user.id;

  // Simpan profil tambahan di tabel public.users
  const { error: profileError } = await supabase.from("users").insert({
    id: userId,
    nama_lengkap,
    username,
    email,
    no_hp,
    role: "customer",
  });
  if (profileError) throw profileError;

  return data.user;
}

// --- Login pelanggan / admin (satu mekanisme, dibedakan lewat tabel profil) ---
export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function logout() {
  await supabase.auth.signOut();
}

// --- Ambil user yang sedang login + profilnya ---
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Cek apakah dia admin dulu, kalau tidak baru cek customer
  const { data: admin } = await supabase.from("admin").select("*").eq("id", user.id).maybeSingle();
  if (admin) return { ...admin, authUser: user, isAdmin: true };

  const { data: customer } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
  return customer ? { ...customer, authUser: user, isAdmin: false } : null;
}

export function onAuthChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
}
