-- Voeg star_override toe aan players
-- null = gebruik berekend (wins×3 + niet-winsten×1)
-- getal = handmatige override door manager

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS star_override int DEFAULT NULL;
