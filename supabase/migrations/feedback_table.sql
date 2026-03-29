-- Feedback tabel met RLS
-- Uitvoeren in Supabase SQL Editor

-- Maak tabel aan als die nog niet bestaat
CREATE TABLE IF NOT EXISTS feedback (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('bug', 'wens')),
  title text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_at timestamptz DEFAULT now()
);

-- Voeg status-kolom toe als de tabel al bestond zonder die kolom
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'done'));

-- RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Gebruikers mogen alleen hun eigen feedback indienen
CREATE POLICY "users can submit feedback"
  ON feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Geen SELECT-policy voor gewone gebruikers:
-- feedback van anderen is niet leesbaar via de anon key.
-- De developer leest via de service role key (bypast RLS).
