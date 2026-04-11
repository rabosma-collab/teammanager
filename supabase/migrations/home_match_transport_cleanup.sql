-- Verwijder bestaande vervoer-assignments bij thuiswedstrijden.
-- Vervoer geldt alleen voor uitwedstrijden.

UPDATE matches
SET transport_player_ids = '{}'
WHERE home_away = 'Thuis'
  AND COALESCE(array_length(transport_player_ids, 1), 0) > 0;