-- ============================================================
-- match_report.sql
--
-- Voegt wedstrijdverslag toe aan matches:
--   1. matches.match_report — optionele tekst, max 2000 tekens
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
-- ============================================================

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS match_report text;
