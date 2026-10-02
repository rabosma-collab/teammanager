-- ============================================================
-- recalculate_season_played_minutes.sql
--
-- EENMALIG HERSTEL: herberekent players.played_min zodat het
-- alleen de gespeelde minuten van het ACTIEVE seizoen bevat.
--
-- Nodig omdat played_min bij het aanmaken van een nieuw seizoen
-- niet werd gereset (bug); daardoor liepen minuten van vorig
-- seizoen door. Dit script zet played_min terug op 0 en telt de
-- minuten van alle afgeronde wedstrijden in het actieve seizoen
-- opnieuw op (rotatie-aware, zelfde algoritme als finalize_match).
--
-- VEILIG & IDEMPOTENT — mag meerdere keren gedraaid worden.
--
-- HOE UITVOEREN:
--   Plak dit HELE script in de Supabase SQL Editor (niets selecteren)
--   en klik op Run.
-- ============================================================

DO $$
DECLARE
  v_match    record;
  v_sub      record;
  v_duration integer;
BEGIN
  -- Reset gespeelde minuten voor alle spelers
  UPDATE players SET played_min = 0;

  -- Loop over afgeronde wedstrijden in het ACTIEVE seizoen van hun team
  FOR v_match IN
    SELECT m.id, m.team_id
    FROM matches m
    JOIN seasons s ON s.id = m.season_id AND s.is_active = true
    WHERE m.match_status = 'afgerond'
  LOOP
    -- Speelduur uit team_settings (default 60)
    SELECT COALESCE(match_duration, 60) INTO v_duration
    FROM team_settings WHERE team_id = v_match.team_id;
    IF v_duration IS NULL THEN v_duration := 60; END IF;

    DROP TABLE IF EXISTS _pt;
    DROP TABLE IF EXISTS _gids;

    -- Rotatie-aware spelerstabel
    CREATE TEMP TABLE _pt (
      player_id integer NOT NULL,
      is_guest  boolean NOT NULL DEFAULT false,
      p_min     integer NOT NULL DEFAULT 0,
      on_field  boolean NOT NULL DEFAULT true,
      entry_min integer NOT NULL DEFAULT 0
    ) ON COMMIT DROP;

    -- Basisspelers vanaf minuut 0 op het veld
    INSERT INTO _pt (player_id, is_guest, p_min, on_field, entry_min)
    SELECT player_id, false, 0, true, 0
    FROM lineups WHERE match_id = v_match.id;

    -- Gastspelers met lineup-positie
    INSERT INTO _pt (player_id, is_guest, p_min, on_field, entry_min)
    SELECT id, true, 0, true, 0
    FROM guest_players
    WHERE match_id = v_match.id AND lineup_position IS NOT NULL;

    -- Gastspeler-IDs voor disambiguatie bij wissels
    CREATE TEMP TABLE _gids ON COMMIT DROP AS
    SELECT id FROM guest_players WHERE match_id = v_match.id;

    -- Wissels op volgorde van minuut
    FOR v_sub IN
      SELECT player_out_id, player_in_id, COALESCE(custom_minute, minute) AS eff_min
      FROM substitutions WHERE match_id = v_match.id
      ORDER BY COALESCE(custom_minute, minute) ASC
    LOOP
      UPDATE _pt
      SET p_min    = p_min + (v_sub.eff_min - entry_min),
          on_field = false
      WHERE player_id = v_sub.player_out_id
        AND on_field = true;

      IF EXISTS (SELECT 1 FROM _pt WHERE player_id = v_sub.player_in_id) THEN
        UPDATE _pt
        SET on_field  = true,
            entry_min = v_sub.eff_min
        WHERE player_id = v_sub.player_in_id;
      ELSE
        INSERT INTO _pt (player_id, is_guest, p_min, on_field, entry_min)
        VALUES (
          v_sub.player_in_id,
          EXISTS(SELECT 1 FROM _gids WHERE id = v_sub.player_in_id),
          0, true, v_sub.eff_min
        );
      END IF;
    END LOOP;

    -- Spelers nog op het veld: afsluiten op eindtijd
    UPDATE _pt
    SET p_min = p_min + (v_duration - entry_min)
    WHERE on_field = true;

    -- Gespeelde minuten optellen bij reguliere spelers
    UPDATE players p
    SET played_min = p.played_min + pt.p_min
    FROM _pt pt
    WHERE p.id = pt.player_id
      AND NOT pt.is_guest
      AND p.team_id = v_match.team_id;
  END LOOP;
END $$;
