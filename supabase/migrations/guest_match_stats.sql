-- ============================================================
-- guest_match_stats.sql
--
-- Maakt het mogelijk om per-wedstrijd statistieken (doelpunten,
-- assists, gele/rode kaarten, eigen doelpunten) toe te kennen aan
-- gastspelers bij het afsluiten van een wedstrijd.
--
--   1. Kaart-/own_goal-kolommen op guest_players
--   2. save_match_stats RPC uitgebreid met een guest_player_id-tak
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
-- ============================================================

-- 1. Kolommen toevoegen aan guest_players
ALTER TABLE public.guest_players
  ADD COLUMN IF NOT EXISTS yellow_cards integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS red_cards    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS own_goals    integer NOT NULL DEFAULT 0;


-- ============================================================
-- RPC: save_match_stats (met gastspeler-ondersteuning)
--
-- Elke stat-rij in p_stats bevat óf player_id óf guest_player_id.
-- Reguliere spelers werken hun career-totaal bij op players;
-- gastspelers werken hun (per-wedstrijd) totaal bij op guest_players.
-- ============================================================
CREATE OR REPLACE FUNCTION public.save_match_stats(
  p_match_id  integer,
  p_team_id   uuid,
  p_stats     jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  stat              jsonb;
  v_player_id       integer;
  v_guest_id        integer;
  v_old_goals       integer := 0;
  v_old_assists     integer := 0;
  v_old_yellow      integer := 0;
  v_old_red         integer := 0;
  v_old_own_goals   integer := 0;
  v_new_goals       integer;
  v_new_assists     integer;
  v_new_yellow      integer;
  v_new_red         integer;
  v_new_own_goals   integer;
BEGIN
  -- Alleen managers mogen statistieken opslaan
  IF NOT is_team_manager(p_team_id) THEN
    RAISE EXCEPTION 'Unauthorized: only managers can save match stats';
  END IF;

  -- Verifieer dat de wedstrijd bij dit team hoort
  IF NOT EXISTS (
    SELECT 1 FROM matches WHERE id = p_match_id AND team_id = p_team_id
  ) THEN
    RAISE EXCEPTION 'Match not found in this team';
  END IF;

  -- Verwerk elke speler-stat in de array
  FOR stat IN SELECT * FROM jsonb_array_elements(p_stats)
  LOOP
    v_player_id     := NULLIF(stat->>'player_id', '')::integer;
    v_guest_id      := NULLIF(stat->>'guest_player_id', '')::integer;
    v_new_goals     := COALESCE((stat->>'goals')::integer, 0);
    v_new_assists   := COALESCE((stat->>'assists')::integer, 0);
    v_new_yellow    := COALESCE((stat->>'yellow_cards')::integer, 0);
    v_new_red       := COALESCE((stat->>'red_cards')::integer, 0);
    v_new_own_goals := COALESCE((stat->>'own_goals')::integer, 0);

    IF v_guest_id IS NOT NULL THEN
      -- ── Gastspeler ──────────────────────────────────────────
      -- Verifieer dat de gastspeler bij deze wedstrijd/team hoort
      IF NOT EXISTS (
        SELECT 1 FROM guest_players
        WHERE id = v_guest_id AND match_id = p_match_id AND team_id = p_team_id
      ) THEN
        CONTINUE;
      END IF;

      SELECT
        COALESCE(goals, 0), COALESCE(assists, 0),
        COALESCE(yellow_cards, 0), COALESCE(red_cards, 0), COALESCE(own_goals, 0)
      INTO v_old_goals, v_old_assists, v_old_yellow, v_old_red, v_old_own_goals
      FROM match_player_stats
      WHERE match_id = p_match_id AND guest_player_id = v_guest_id;

      IF NOT FOUND THEN
        v_old_goals := 0; v_old_assists := 0; v_old_yellow := 0; v_old_red := 0; v_old_own_goals := 0;
      END IF;

      INSERT INTO match_player_stats (
        match_id, team_id, guest_player_id, goals, assists, yellow_cards, red_cards, own_goals, updated_at
      )
      VALUES (
        p_match_id, p_team_id, v_guest_id,
        v_new_goals, v_new_assists, v_new_yellow, v_new_red, v_new_own_goals, now()
      )
      ON CONFLICT (match_id, guest_player_id) DO UPDATE
      SET goals        = v_new_goals,
          assists      = v_new_assists,
          yellow_cards = v_new_yellow,
          red_cards    = v_new_red,
          own_goals    = v_new_own_goals,
          updated_at   = now();

      UPDATE guest_players
      SET
        goals        = GREATEST(0, goals        + (v_new_goals     - v_old_goals)),
        assists      = GREATEST(0, assists      + (v_new_assists   - v_old_assists)),
        yellow_cards = GREATEST(0, yellow_cards + (v_new_yellow    - v_old_yellow)),
        red_cards    = GREATEST(0, red_cards    + (v_new_red       - v_old_red)),
        own_goals    = GREATEST(0, own_goals    + (v_new_own_goals - v_old_own_goals))
      WHERE id = v_guest_id AND match_id = p_match_id AND team_id = p_team_id;

    ELSIF v_player_id IS NOT NULL THEN
      -- ── Reguliere speler ────────────────────────────────────
      SELECT
        COALESCE(goals, 0), COALESCE(assists, 0),
        COALESCE(yellow_cards, 0), COALESCE(red_cards, 0), COALESCE(own_goals, 0)
      INTO v_old_goals, v_old_assists, v_old_yellow, v_old_red, v_old_own_goals
      FROM match_player_stats
      WHERE match_id = p_match_id AND player_id = v_player_id;

      IF NOT FOUND THEN
        v_old_goals := 0; v_old_assists := 0; v_old_yellow := 0; v_old_red := 0; v_old_own_goals := 0;
      END IF;

      INSERT INTO match_player_stats (
        match_id, team_id, player_id, goals, assists, yellow_cards, red_cards, own_goals, updated_at
      )
      VALUES (
        p_match_id, p_team_id, v_player_id,
        v_new_goals, v_new_assists, v_new_yellow, v_new_red, v_new_own_goals, now()
      )
      ON CONFLICT (match_id, player_id) DO UPDATE
      SET goals        = v_new_goals,
          assists      = v_new_assists,
          yellow_cards = v_new_yellow,
          red_cards    = v_new_red,
          own_goals    = v_new_own_goals,
          updated_at   = now();

      UPDATE players
      SET
        goals        = GREATEST(0, goals        + (v_new_goals     - v_old_goals)),
        assists      = GREATEST(0, assists      + (v_new_assists   - v_old_assists)),
        yellow_cards = GREATEST(0, yellow_cards + (v_new_yellow    - v_old_yellow)),
        red_cards    = GREATEST(0, red_cards    + (v_new_red       - v_old_red)),
        own_goals    = GREATEST(0, own_goals    + (v_new_own_goals - v_old_own_goals))
      WHERE id = v_player_id AND team_id = p_team_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_match_stats TO authenticated;
