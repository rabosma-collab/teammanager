-- ============================================================
-- delete_player_cascade.sql
--
-- SECURITY DEFINER functie om een speler en alle gerelateerde
-- records atomisch te verwijderen, inclusief tabellen waarvoor
-- de manager geen directe DELETE RLS heeft (stat_credits,
-- stat_credit_transactions).
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
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
  -- Alleen managers mogen een speler verwijderen
  IF NOT is_team_manager(p_team_id) THEN
    RAISE EXCEPTION 'Unauthorized: only managers can delete players';
  END IF;

  -- Verifieer dat de speler bij dit team hoort
  IF NOT EXISTS (
    SELECT 1 FROM players WHERE id = p_player_id AND team_id = p_team_id
  ) THEN
    RAISE EXCEPTION 'Player not found in this team';
  END IF;

  -- Ruim gerelateerde records op (volgorde: eerst de FK-kinderen)
  DELETE FROM lineups           WHERE player_id = p_player_id;
  DELETE FROM substitutions     WHERE player_out_id = p_player_id
                                   OR player_in_id  = p_player_id;
  DELETE FROM match_absences    WHERE player_id = p_player_id;
  DELETE FROM player_of_week_votes
                                WHERE voted_for_player_id = p_player_id
                                   OR voter_player_id     = p_player_id;
  DELETE FROM stat_credit_transactions WHERE player_id = p_player_id;
  DELETE FROM stat_credits      WHERE player_id = p_player_id;
  DELETE FROM team_members      WHERE player_id = p_player_id;

  -- Verwijder de speler zelf
  DELETE FROM players WHERE id = p_player_id AND team_id = p_team_id;
END;
$$;
