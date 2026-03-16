-- Match logistics: assembly time, match time, location details
-- Run this in the Supabase SQL Editor

-- 1. Add logistics columns to matches table
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS assembly_time time,
  ADD COLUMN IF NOT EXISTS match_time time,
  ADD COLUMN IF NOT EXISTS location_details text;

-- 2. Add feature toggles to team_settings table
ALTER TABLE team_settings
  ADD COLUMN IF NOT EXISTS track_assembly_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_match_time boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS track_location_details boolean NOT NULL DEFAULT false;
