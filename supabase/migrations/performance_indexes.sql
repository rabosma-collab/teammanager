-- Performance indexes voor veelgebruikte query-paden
-- Veilig uit te voeren: IF NOT EXISTS voorkomt fouten bij dubbel uitvoeren

-- players
CREATE INDEX IF NOT EXISTS idx_players_team_id
  ON public.players (team_id);

-- matches
CREATE INDEX IF NOT EXISTS idx_matches_team_id
  ON public.matches (team_id);
CREATE INDEX IF NOT EXISTS idx_matches_team_id_date
  ON public.matches (team_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_matches_team_id_status
  ON public.matches (team_id, match_status);

-- lineups
CREATE INDEX IF NOT EXISTS idx_lineups_match_id
  ON public.lineups (match_id);

-- substitutions
CREATE INDEX IF NOT EXISTS idx_substitutions_match_id
  ON public.substitutions (match_id);

-- match_absences
CREATE INDEX IF NOT EXISTS idx_match_absences_match_id
  ON public.match_absences (match_id);
CREATE INDEX IF NOT EXISTS idx_match_absences_player_id
  ON public.match_absences (player_id);

-- activity_log
CREATE INDEX IF NOT EXISTS idx_activity_log_team_id_created
  ON public.activity_log (team_id, created_at DESC);

-- player_of_week_votes
CREATE INDEX IF NOT EXISTS idx_spdw_votes_team_match
  ON public.player_of_week_votes (team_id, match_id);
CREATE INDEX IF NOT EXISTS idx_spdw_votes_match_id
  ON public.player_of_week_votes (match_id);

-- stat_credits
CREATE INDEX IF NOT EXISTS idx_stat_credits_player_team
  ON public.stat_credits (player_id, team_id);

-- team_members
CREATE INDEX IF NOT EXISTS idx_team_members_user_id
  ON public.team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id
  ON public.team_members (team_id);
