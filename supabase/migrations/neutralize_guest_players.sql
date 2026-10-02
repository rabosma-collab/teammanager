-- ============================================================
-- neutralize_guest_players.sql  (FASE 2 — na migratie)
--
-- Na migrate_guests_to_players.sql zijn alle gasten verhuisd naar
-- players (status='guest'). De oude guest_players-rijen bestaan nog als
-- rollback-pad, maar worden door niets meer gelezen in de app.
--
-- PROBLEEM dat dit script voorkomt:
--   finalize_match() en de recalculate-scripts bouwen een temp-tabel _gids
--   uit guest_players om wissels te herkennen. Na de migratie wijzen
--   wissels/opstelling naar players.id; als een players.id numeriek
--   samenvalt met een oude guest_players.id, kan een HERBEREKENING van een
--   AFGESLOTEN wedstrijd een speler onterecht als gast behandelen
--   (dubbeltelling / verkeerde minuten).
--
-- OPLOSSING: maak guest_players leeg. De data staat veilig in
--   _backup_guest_players en is al naar players gemigreerd. Hierdoor is
--   _gids altijd leeg en behandelen finalize_match/recalc iedereen correct
--   als reguliere speler.
--
-- VEILIG: match_player_stats.guest_player_id is door de migratie op NULL
--   gezet, dus er zijn geen FK-verwijzingen meer naar guest_players.
-- ============================================================

BEGIN;

-- Veiligheidscheck: backup én migratie moeten bestaan
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_backup_guest_players') THEN
    RAISE EXCEPTION 'Backup _backup_guest_players ontbreekt — draai eerst migrate_guests_to_players.sql.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_migration_map') THEN
    RAISE EXCEPTION 'guest_migration_map ontbreekt — migratie niet uitgevoerd.';
  END IF;
  -- Geen enkele stat-rij mag nog naar een gast verwijzen
  IF EXISTS (SELECT 1 FROM match_player_stats WHERE guest_player_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Er bestaan nog match_player_stats met guest_player_id — migratie onvolledig.';
  END IF;
END $$;

-- Oude gast-appearances leegmaken (origineel staat in _backup_guest_players)
DELETE FROM guest_players;

COMMIT;
