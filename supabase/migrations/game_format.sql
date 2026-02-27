-- Migration: add game_format and periods to team_settings
-- Run this in the Supabase SQL editor

ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS game_format text NOT NULL DEFAULT '11v11',
  ADD COLUMN IF NOT EXISTS periods     int  NOT NULL DEFAULT 2;
