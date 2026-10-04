-- ============================================================
-- analytics_usage.sql — Inzicht in gebruik & actieve teams
--
-- Draai deze query's los in de Supabase SQL Editor (één tegelijk).
-- Alles is READ-ONLY. Pas de intervallen aan naar wens.
-- ============================================================


-- ------------------------------------------------------------
-- 1. GEBRUIKERS — hoeveel mensen gebruiken de app echt?
-- ------------------------------------------------------------

-- 1a. Totaal geregistreerd + actief in venster (op basis van login)
SELECT
  count(*)                                                       AS totaal_gebruikers,
  count(*) FILTER (WHERE last_sign_in_at >= now() - interval '1 day')  AS actief_24u,
  count(*) FILTER (WHERE last_sign_in_at >= now() - interval '7 days') AS actief_7d,
  count(*) FILTER (WHERE last_sign_in_at >= now() - interval '30 days')AS actief_30d,
  count(*) FILTER (WHERE last_sign_in_at IS NULL)                AS nooit_ingelogd
FROM auth.users;

-- 1b. Nieuwe aanmeldingen per week (registratietrend)
SELECT
  date_trunc('week', created_at)::date AS week,
  count(*)                             AS nieuwe_gebruikers
FROM auth.users
GROUP BY 1
ORDER BY 1 DESC;

-- 1c. Dagelijks actieve gebruikers (DAU) op basis van app-events (laatste 30 dagen)
--     Telt unieke INGELOGDE gebruikers die iets deden (via activity_log_reads).
SELECT
  date_trunc('day', created_at_reads)::date AS dag,
  count(DISTINCT user_id)                    AS actieve_gebruikers
FROM (
  SELECT alr.user_id, al.created_at AS created_at_reads
  FROM activity_log_reads alr
  JOIN activity_log al ON al.id = alr.activity_id
) x
WHERE created_at_reads >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 DESC;


-- ------------------------------------------------------------
-- 2. TEAMS — hoeveel en welke teams zijn echt actief?
-- ------------------------------------------------------------

-- 2a. Teamtelling op hoofdlijnen
SELECT
  count(*)                                           AS totaal_teams,
  count(*) FILTER (WHERE setup_done)                 AS setup_voltooid,
  count(*) FILTER (WHERE status = 'active')          AS status_actief
FROM teams;

-- 2b. Welke teams zijn actief? — ledenaantal + laatste activiteit
--     "Actief" = heeft activity_log-events in de laatste 30 dagen.
SELECT
  t.name                                           AS team,
  t.setup_done,
  t.status,
  count(DISTINCT tm.id) FILTER (WHERE tm.status = 'active') AS actieve_leden,
  count(al.id) FILTER (WHERE al.created_at >= now() - interval '30 days') AS events_30d,
  count(al.id) FILTER (WHERE al.created_at >= now() - interval '7 days')  AS events_7d,
  max(al.created_at)                               AS laatste_activiteit
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
LEFT JOIN activity_log  al ON al.team_id = t.id
GROUP BY t.id, t.name, t.setup_done, t.status
ORDER BY laatste_activiteit DESC NULLS LAST;

-- 2c. Samenvatting: aantal ECHT actieve teams (activiteit in venster)
SELECT
  count(DISTINCT team_id) FILTER (WHERE created_at >= now() - interval '7 days')  AS actieve_teams_7d,
  count(DISTINCT team_id) FILTER (WHERE created_at >= now() - interval '30 days') AS actieve_teams_30d
FROM activity_log;

-- 2d. Soort activiteit per team (waar wordt de app voor gebruikt?)
SELECT
  t.name       AS team,
  al.type      AS event_type,
  count(*)     AS aantal
FROM activity_log al
JOIN teams t ON t.id = al.team_id
WHERE al.created_at >= now() - interval '30 days'
GROUP BY t.name, al.type
ORDER BY t.name, aantal DESC;


-- ------------------------------------------------------------
-- 3. LEDEN & ROLLEN — bezetting per team
-- ------------------------------------------------------------
SELECT
  t.name                                              AS team,
  count(*) FILTER (WHERE tm.role = 'manager' AND tm.status = 'active') AS managers,
  count(*) FILTER (WHERE tm.role = 'staff'   AND tm.status = 'active') AS staff,
  count(*) FILTER (WHERE tm.role = 'player'  AND tm.status = 'active') AS spelers,
  count(*) FILTER (WHERE tm.status = 'active')        AS totaal_actief
FROM teams t
LEFT JOIN team_members tm ON tm.team_id = t.id
GROUP BY t.id, t.name
ORDER BY totaal_actief DESC;
