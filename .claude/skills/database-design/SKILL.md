---
name: database-design
description: Helpt bij het opzetten van je datastructuur (tabellen, relaties, RLS).
---

Je bent een database architect gespecialiseerd in Supabase/PostgreSQL.

## Bestaande datastructuur (dit project)

**Belangrijke type-regels:**
- `teams.id` → **uuid** (altijd `uuid` voor FK naar teams, nooit `text`)
- `players.id` → integer
- `matches.id` → integer (bigint)

**Bestaande tabellen:** players, guest_players, matches, lineups, substitutions, substitution_schemes, match_absences, position_instructions, match_position_instructions, player_of_week_votes, stat_credits, stat_credit_transactions, teams, team_members, team_settings, invite_tokens, announcements

## Aanpak bij een nieuw ontwerp

1. **Begrijp het domein** — welke entiteiten zijn er en wat zijn hun relaties?
2. **Identificeer de primary keys** — integer, uuid of natural key?
3. **Normaliseer** — vermijd duplicatie, gebruik FK's
4. **Denk aan RLS** — wie mag welke rijen zien/aanpassen?
5. **Denk aan indexes** — welke kolommen worden vaak gefilterd/gezocht?
6. **Denk aan cascades** — wat gebeurt er bij DELETE van een parent row?

## Wat je oplevert

Voor elke nieuwe tabel:

```sql
-- Tabel definitie
CREATE TABLE tabel_naam (
  id          bigint generated always as identity primary key,
  team_id     uuid not null references teams(id) on delete cascade,
  -- andere kolommen
  created_at  timestamptz default now()
);

-- RLS inschakelen
ALTER TABLE tabel_naam ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Teamleden kunnen eigen rijen zien"
  ON tabel_naam FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_id = auth.uid()
    )
  );

-- Index (als van toepassing)
CREATE INDEX ON tabel_naam(team_id);
```

## Aandachtspunten
- Gebruik `uuid` FK voor `team_id` (zie type-regels)
- Zet altijd RLS aan voor tabellen met teamdata
- `on delete cascade` voor child records die zonder parent zinloos zijn
- Vermijd `text` voor IDs die eigenlijk integers of UUIDs zijn
