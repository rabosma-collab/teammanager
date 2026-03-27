-- Add bonus_wins and bonus_draws columns to players table
-- These allow managers to add historical match results (pre-app or other teams)
-- that count toward a player's Teamsterren star total.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS bonus_wins  int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_draws int NOT NULL DEFAULT 0;
