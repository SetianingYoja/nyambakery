-- =====================================================================
-- CLEANUP: hapus tabel ai_agent_settings
-- Jalankan ini SEKALI di SQL Editor Supabase kamu KALAU sebelumnya kamu
-- sudah sempat menjalankan file `increment_ai_agent.sql` yang lama.
-- AI Agent sekarang murni service backend (bukan chatbot dengan
-- pengaturan nama/sapaan/prompt yang disimpan di database), jadi tabel
-- ini tidak dipakai lagi.
-- =====================================================================

drop policy if exists "admin manage ai_agent_settings" on public.ai_agent_settings;
drop table if exists public.ai_agent_settings;
