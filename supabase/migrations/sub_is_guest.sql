-- Fix B: onderscheid guest vs. reguliere spelers in wissels
-- Voorkomen dat een gastspeler en een reguliere speler met hetzelfde numerieke ID
-- worden verward bij het berekenen van de opstelling per periode.

ALTER TABLE substitutions
  ADD COLUMN IF NOT EXISTS player_out_is_guest boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS player_in_is_guest  boolean NOT NULL DEFAULT false;
