-- Voeg sub_moments toe aan matches (nullable voor backward compat met bestaande wedstrijden)
-- 0 = vrije wissels, 1-4 = vaste wisselmomenten, null = legacy (gebruikt substitution_scheme_id)
alter table matches add column if not exists sub_moments int;
