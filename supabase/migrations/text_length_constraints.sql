-- Handhaaf tekstlimieten op databaseniveau zodat UI en opslag gelijk blijven.

ALTER TABLE IF EXISTS public.matches
  DROP CONSTRAINT IF EXISTS matches_match_report_max_length_chk;

ALTER TABLE IF EXISTS public.matches
  ADD CONSTRAINT matches_match_report_max_length_chk
  CHECK (match_report IS NULL OR char_length(match_report) <= 4000);

ALTER TABLE IF EXISTS public.announcements
  DROP CONSTRAINT IF EXISTS announcements_message_max_length_chk;

ALTER TABLE IF EXISTS public.announcements
  ADD CONSTRAINT announcements_message_max_length_chk
  CHECK (message IS NULL OR char_length(message) <= 4000);