-- ============================================================
-- lineup_published.sql
--
-- Voegt lineup_published kolom toe aan matches tabel.
-- Geeft aan of de manager de opstelling definitief heeft gemaakt
-- (zichtbaar voor spelers op het dashboard).
--
-- Uitvoeren in Supabase SQL Editor (eenmalig).
-- ============================================================

ALTER TABLE matches ADD COLUMN IF NOT EXISTS lineup_published boolean DEFAULT false;
