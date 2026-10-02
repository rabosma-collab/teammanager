-- ============================================================
-- migrate_guests_to_players.sql  (FASE 1 — datamigratie)
--
-- Zet ad-hoc gastspelers (guest_players, 1 rij per wedstrijd) om naar
-- gewone players-rijen met status='guest', per wedstrijd geselecteerd via
-- match_guest_selections. Historische verwijzingen (opstelling, wissels,
-- stats) worden omgemapt naar de nieuwe players.id.
--
-- VEILIGHEID:
--   * Draait volledig in één transactie: bij ELKE fout (bijv. ontbrekende
--     kolom of schending van een constraint) rolt ALLES terug.
--   * guest_players / guest_player_pool worden NIET verwijderd (rollback-pad).
--   * Idempotent: een mappingtabel (guest_migration_map) voorkomt dubbel werk.
--   * Zelf-verificatie aan het eind: aborteert als tellingen niet kloppen.
--
-- DRAAI DIT EERST OP EEN KOPIE/BRANCH VAN DE PRODUCTIEDATABASE.
--   Controleer daarna met de queries onderaan of afgesloten wedstrijden
--   identiek blijven (minuten, stats, opstelling, wissels).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 0a. In-DB backup van de te wijzigen tabellen
--     (rollback-pad zonder externe backup; blijft bij her-run staan)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS _backup_guest_players      AS SELECT * FROM guest_players;
CREATE TABLE IF NOT EXISTS _backup_match_player_stats AS SELECT * FROM match_player_stats;
CREATE TABLE IF NOT EXISTS _backup_substitutions      AS SELECT * FROM substitutions;
CREATE TABLE IF NOT EXISTS _backup_lineups            AS SELECT * FROM lineups;
CREATE TABLE IF NOT EXISTS _backup_players            AS SELECT * FROM players;

-- ------------------------------------------------------------
-- 0b. Mappingtabel (oude guest_players.id -> nieuwe players.id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guest_migration_map (
  old_guest_id  integer PRIMARY KEY,         -- guest_players.id (globaal uniek)
  match_id      integer NOT NULL,
  team_id       uuid    NOT NULL,
  name          text    NOT NULL,
  new_player_id integer NOT NULL
);

-- ------------------------------------------------------------
-- 0c. Zorg dat match_guest_selections bestaat (Model A-doeltabel)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_guest_selections (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id    uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  match_id   bigint NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id  int NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_match_guest_selections_match_id
  ON match_guest_selections (match_id);

ALTER TABLE match_guest_selections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_guest_selections_select" ON match_guest_selections;
CREATE POLICY "match_guest_selections_select" ON match_guest_selections
  FOR SELECT USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "match_guest_selections_insert" ON match_guest_selections;
CREATE POLICY "match_guest_selections_insert" ON match_guest_selections
  FOR INSERT WITH CHECK (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );

DROP POLICY IF EXISTS "match_guest_selections_delete" ON match_guest_selections;
CREATE POLICY "match_guest_selections_delete" ON match_guest_selections
  FOR DELETE USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid() AND role = 'manager' AND status = 'active'
    )
  );

-- ------------------------------------------------------------
-- 1. Eén players-rij (status='guest') per (team, genormaliseerde naam)
--    Stats starten op 0; worden in stap 6 gezet uit match_player_stats.
-- ------------------------------------------------------------
WITH distinct_guests AS (
  SELECT
    team_id,
    lower(trim(name))                                   AS lname,
    (array_agg(name     ORDER BY id DESC))[1]           AS display_name,
    (array_agg(position ORDER BY id DESC))[1]           AS position
  FROM guest_players
  GROUP BY team_id, lower(trim(name))
)
INSERT INTO players (
  name, position, team_id, status, injured,
  goals, assists, min, played_min,
  wash_count, consumption_count, transport_count,
  yellow_cards, red_cards, own_goals,
  pac, sho, pas, dri, def, phy
)
SELECT
  dg.display_name, COALESCE(dg.position, ''), dg.team_id, 'guest', false,
  0, 0, 0, 0,
  0, 0, 0,
  0, 0, 0,
  0, 0, 0, 0, 0, 0
FROM distinct_guests dg
WHERE NOT EXISTS (
  SELECT 1 FROM players p
  WHERE p.team_id = dg.team_id
    AND lower(trim(p.name)) = dg.lname
    AND p.status = 'guest'
);

-- ------------------------------------------------------------
-- 2. Vul de mapping: elke guest_players-rij -> bijpassende players-rij
-- ------------------------------------------------------------
INSERT INTO guest_migration_map (old_guest_id, match_id, team_id, name, new_player_id)
SELECT gp.id, gp.match_id, gp.team_id, gp.name, p.id
FROM guest_players gp
JOIN players p
  ON p.team_id = gp.team_id
 AND lower(trim(p.name)) = lower(trim(gp.name))
 AND p.status = 'guest'
WHERE NOT EXISTS (
  SELECT 1 FROM guest_migration_map m WHERE m.old_guest_id = gp.id
);

-- Harde check: elke guest_players-rij moet precies één mapping hebben
DO $$
DECLARE v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing
  FROM guest_players gp
  LEFT JOIN guest_migration_map m ON m.old_guest_id = gp.id
  WHERE m.old_guest_id IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'Mapping onvolledig: % guest_players zonder nieuwe players-rij', v_missing;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. match_guest_selections: markeer per wedstrijd welke gast meedeed
-- ------------------------------------------------------------
INSERT INTO match_guest_selections (team_id, match_id, player_id)
SELECT DISTINCT m.team_id, m.match_id, m.new_player_id
FROM guest_migration_map m
WHERE NOT EXISTS (
  SELECT 1 FROM match_guest_selections s
  WHERE s.match_id = m.match_id AND s.player_id = m.new_player_id
);

-- ------------------------------------------------------------
-- 4. Opstelling: gast-veldposities (guest_players.lineup_position)
--    verhuizen naar de lineups-tabel onder de nieuwe players.id
-- ------------------------------------------------------------
INSERT INTO lineups (match_id, position, player_id)
SELECT gp.match_id, gp.lineup_position, m.new_player_id
FROM guest_players gp
JOIN guest_migration_map m ON m.old_guest_id = gp.id
WHERE gp.lineup_position IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM lineups l
    WHERE l.match_id = gp.match_id AND l.position = gp.lineup_position
  );

-- ------------------------------------------------------------
-- 5. Wissels: gast-id's ommappen naar players.id en vlaggen resetten
-- ------------------------------------------------------------
UPDATE substitutions s
SET player_in_id = m.new_player_id,
    player_in_is_guest = false
FROM guest_migration_map m
WHERE s.player_in_is_guest = true
  AND s.player_in_id = m.old_guest_id
  AND s.match_id = m.match_id;

UPDATE substitutions s
SET player_out_id = m.new_player_id,
    player_out_is_guest = false
FROM guest_migration_map m
WHERE s.player_out_is_guest = true
  AND s.player_out_id = m.old_guest_id
  AND s.match_id = m.match_id;

-- ------------------------------------------------------------
-- 6. Per-wedstrijd stats: guest_player_id -> player_id
-- ------------------------------------------------------------
UPDATE match_player_stats mps
SET player_id = m.new_player_id,
    guest_player_id = NULL
FROM guest_migration_map m
WHERE mps.guest_player_id = m.old_guest_id;

-- Carrièretotalen van de nieuwe gastspelers = som van hun match_player_stats
UPDATE players p
SET goals        = agg.goals,
    assists      = agg.assists,
    yellow_cards = agg.yellow_cards,
    red_cards    = agg.red_cards,
    own_goals    = agg.own_goals
FROM (
  SELECT player_id,
         SUM(goals)        AS goals,
         SUM(assists)      AS assists,
         SUM(yellow_cards) AS yellow_cards,
         SUM(red_cards)    AS red_cards,
         SUM(own_goals)    AS own_goals
  FROM match_player_stats
  WHERE player_id IN (SELECT DISTINCT new_player_id FROM guest_migration_map)
  GROUP BY player_id
) agg
WHERE p.id = agg.player_id;

-- Gespeelde/bankminuten overnemen uit guest_players (som per nieuwe speler)
UPDATE players p
SET min = agg.min
FROM (
  SELECT m.new_player_id, SUM(gp.min) AS min
  FROM guest_players gp
  JOIN guest_migration_map m ON m.old_guest_id = gp.id
  GROUP BY m.new_player_id
) agg
WHERE p.id = agg.new_player_id;

-- ------------------------------------------------------------
-- 7. Zelf-verificatie: aborteer bij afwijkingen
-- ------------------------------------------------------------
DO $$
DECLARE
  v_orphan_stats integer;
  v_orphan_subs  integer;
BEGIN
  -- Geen enkele match_player_stats-rij mag nog naar een gast verwijzen
  SELECT count(*) INTO v_orphan_stats
  FROM match_player_stats WHERE guest_player_id IS NOT NULL;
  IF v_orphan_stats > 0 THEN
    RAISE EXCEPTION 'Nog % stat-rijen met guest_player_id na migratie', v_orphan_stats;
  END IF;

  -- Geen enkele wissel mag nog een gast-vlag hebben
  SELECT count(*) INTO v_orphan_subs
  FROM substitutions WHERE player_in_is_guest = true OR player_out_is_guest = true;
  IF v_orphan_subs > 0 THEN
    RAISE EXCEPTION 'Nog % wissels met is_guest-vlag na migratie', v_orphan_subs;
  END IF;
END $$;

COMMIT;

-- ============================================================
-- CONTROLEQUERY'S (handmatig draaien NA commit, op de kopie)
-- Vergelijk met de situatie vóór de migratie.
-- ============================================================
-- Aantal gemigreerde gasten per team:
--   SELECT team_id, count(*) FROM guest_migration_map GROUP BY team_id;
--
-- Nieuwe gastspelers en hun totalen:
--   SELECT id, name, status, goals, assists, yellow_cards, red_cards, own_goals, min
--   FROM players WHERE status = 'guest' ORDER BY name;
--
-- Opstelling van een specifieke afgesloten wedstrijd (vul :mid in):
--   SELECT position, player_id FROM lineups WHERE match_id = :mid ORDER BY position;
--
-- Wissels van die wedstrijd:
--   SELECT substitution_number, player_out_id, player_in_id FROM substitutions
--   WHERE match_id = :mid ORDER BY substitution_number;
