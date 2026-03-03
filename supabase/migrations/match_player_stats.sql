-- ============================================================
-- match_player_stats.sql
--
-- Tabel voor per-wedstrijd statistieken per speler:
-- doelpunten, assists, gele kaarten, rode kaarten.
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
-- ============================================================

-- 1. Tabel aanmaken
CREATE TABLE IF NOT EXISTS public.match_player_stats (
  id              bigserial PRIMARY KEY,
  match_id        integer   NOT NULL REFERENCES public.matches(id)  ON DELETE CASCADE,
  team_id         uuid      NOT NULL REFERENCES public.teams(id)    ON DELETE CASCADE,
  player_id       integer   NULL     REFERENCES public.players(id)  ON DELETE CASCADE,
  guest_player_id integer   NULL     REFERENCES public.guest_players(id) ON DELETE CASCADE,
  goals           integer   NOT NULL DEFAULT 0,
  assists         integer   NOT NULL DEFAULT 0,
  yellow_cards    integer   NOT NULL DEFAULT 0,
  red_cards       integer   NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Elke combinatie van match + speler is uniek
  UNIQUE (match_id, player_id),
  UNIQUE (match_id, guest_player_id),

  -- Elke rij heeft óf een speler óf een gastspeler (niet beide, niet geen van beide)
  CONSTRAINT player_xor_guest CHECK (
    (player_id IS NOT NULL AND guest_player_id IS NULL) OR
    (player_id IS NULL AND guest_player_id IS NOT NULL)
  )
);

-- 2. Index voor snelle lookups per wedstrijd
CREATE INDEX IF NOT EXISTS idx_match_player_stats_match_id ON public.match_player_stats (match_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_player_id ON public.match_player_stats (player_id);
CREATE INDEX IF NOT EXISTS idx_match_player_stats_team_id ON public.match_player_stats (team_id);

-- 3. RLS inschakelen
ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
DROP POLICY IF EXISTS "team_members_can_read_match_stats" ON public.match_player_stats;
DROP POLICY IF EXISTS "managers_can_write_match_stats"    ON public.match_player_stats;

-- Iedereen in het team mag stats lezen
CREATE POLICY "team_members_can_read_match_stats"
  ON public.match_player_stats FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = match_player_stats.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'active'
    )
  );

-- Managers mogen stats aanmaken/aanpassen (via SECURITY DEFINER functies)
-- De RPC-functies doen de eigen auth-check, INSERT/UPDATE/DELETE via service-role
CREATE POLICY "managers_can_write_match_stats"
  ON public.match_player_stats FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.team_id = match_player_stats.team_id
        AND tm.user_id = auth.uid()
        AND tm.role = 'manager'
        AND tm.status = 'active'
    )
  );


-- ============================================================
-- RPC: save_match_stats
--
-- Slaat per-wedstrijd statistieken op en past de career-totalen
-- van spelers delta-gewijs bij (zodat bestaande data intact blijft).
--
-- Parameters:
--   p_match_id  : wedstrijd-ID
--   p_team_id   : team-UUID
--   p_stats     : JSON array van {player_id, goals, assists,
--                  yellow_cards, red_cards}
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
  stat           jsonb;
  v_player_id    integer;
  v_old_goals    integer := 0;
  v_old_assists  integer := 0;
  v_old_yellow   integer := 0;
  v_old_red      integer := 0;
  v_new_goals    integer;
  v_new_assists  integer;
  v_new_yellow   integer;
  v_new_red      integer;
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
    v_player_id   := (stat->>'player_id')::integer;
    v_new_goals   := COALESCE((stat->>'goals')::integer, 0);
    v_new_assists := COALESCE((stat->>'assists')::integer, 0);
    v_new_yellow  := COALESCE((stat->>'yellow_cards')::integer, 0);
    v_new_red     := COALESCE((stat->>'red_cards')::integer, 0);

    -- Haal de HUIDIGE match-stats op voor delta-berekening
    SELECT
      COALESCE(goals, 0),
      COALESCE(assists, 0),
      COALESCE(yellow_cards, 0),
      COALESCE(red_cards, 0)
    INTO v_old_goals, v_old_assists, v_old_yellow, v_old_red
    FROM match_player_stats
    WHERE match_id = p_match_id AND player_id = v_player_id;

    IF NOT FOUND THEN
      v_old_goals := 0; v_old_assists := 0; v_old_yellow := 0; v_old_red := 0;
    END IF;

    -- Upsert match_player_stats (maak aan of update)
    INSERT INTO match_player_stats (
      match_id, team_id, player_id, goals, assists, yellow_cards, red_cards, updated_at
    )
    VALUES (
      p_match_id, p_team_id, v_player_id,
      v_new_goals, v_new_assists, v_new_yellow, v_new_red, now()
    )
    ON CONFLICT (match_id, player_id) DO UPDATE
    SET goals        = v_new_goals,
        assists      = v_new_assists,
        yellow_cards = v_new_yellow,
        red_cards    = v_new_red,
        updated_at   = now();

    -- Pas career-totaal delta-gewijs toe op de speler
    -- (GREATEST 0 voorkomt negatieve waarden bij correcties)
    UPDATE players
    SET
      goals        = GREATEST(0, goals        + (v_new_goals   - v_old_goals)),
      assists      = GREATEST(0, assists      + (v_new_assists - v_old_assists)),
      yellow_cards = GREATEST(0, yellow_cards + (v_new_yellow  - v_old_yellow)),
      red_cards    = GREATEST(0, red_cards    + (v_new_red     - v_old_red))
    WHERE id = v_player_id AND team_id = p_team_id;
  END LOOP;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Rechten
GRANT EXECUTE ON FUNCTION public.save_match_stats TO authenticated;


-- ============================================================
-- Uitbreid delete_player_cascade om ook match_player_stats te
-- verwijderen wanneer een speler wordt verwijderd.
-- (hernoem de functie niet — voeg gewoon de extra DELETE toe)
-- ============================================================
CREATE OR REPLACE FUNCTION public.delete_player_cascade(
  p_player_id int,
  p_team_id   uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_team_manager(p_team_id) THEN
    RAISE EXCEPTION 'Unauthorized: only managers can delete players';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = p_player_id AND team_id = p_team_id
  ) THEN
    RAISE EXCEPTION 'Player not found in this team';
  END IF;

  DELETE FROM lineups                WHERE player_id = p_player_id;
  DELETE FROM substitutions          WHERE player_out_id = p_player_id
                                        OR player_in_id  = p_player_id;
  DELETE FROM match_absences         WHERE player_id = p_player_id;
  DELETE FROM match_player_stats     WHERE player_id = p_player_id;
  DELETE FROM player_of_week_votes   WHERE voted_for_player_id = p_player_id
                                        OR voter_player_id     = p_player_id;
  DELETE FROM stat_credit_transactions WHERE player_id = p_player_id;
  DELETE FROM stat_credits           WHERE player_id = p_player_id;
  DELETE FROM team_members           WHERE player_id = p_player_id;

  DELETE FROM players WHERE id = p_player_id AND team_id = p_team_id;
END;
$$;
