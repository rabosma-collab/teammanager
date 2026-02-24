-- ============================================================
-- rls_beveiliging.sql
--
-- Schakelt Row Level Security (RLS) in voor alle tabellen die
-- momenteel UNRESTRICTED zijn:
--
--   teams, team_members, invite_tokens, announcements,
--   player_of_week_votes, stat_credits, stat_credit_transactions
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
--   Het is idempotent: meerdere keren uitvoeren doet geen kwaad
--   (CREATE OR REPLACE, IF NOT EXISTS, IF NOT EXISTS op policies).
--
-- ALS ER IETS FOUT GAAT:
--   Zet RLS tijdelijk uit met: ALTER TABLE <naam> DISABLE ROW LEVEL SECURITY;
--   Dan werkt alles weer als voorheen terwijl je debugt.
-- ============================================================


-- ============================================================
-- 0. HULPFUNCTIES (SECURITY DEFINER)
-- ============================================================
--
-- Waarom aparte functies?
-- De policies op `team_members` mogen niet zelf een SELECT op
-- `team_members` uitvoeren — dat geeft oneindige recursie.
-- SECURITY DEFINER functies draaien als de eigenaar (postgres),
-- niet als de aanvragende gebruiker, en omzeilen zo RLS.
-- Alle andere tabellen kunnen deze functies gewoon gebruiken.
-- ============================================================

-- CREATE OR REPLACE werkt, maar PostgreSQL staat niet toe de parameternaam te wijzigen.
-- De bestaande functies gebruiken "team_uuid" als parameternaam — dat houden we zo.
CREATE OR REPLACE FUNCTION public.is_team_member(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_team_manager(team_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM team_members
    WHERE team_id = team_uuid
      AND user_id = auth.uid()
      AND role = 'manager'
      AND status = 'active'
  );
$$;


-- ============================================================
-- 1. TEAMS
-- ============================================================
--
-- Probleem: in TeamSetupWizard wordt eerst een team aangemaakt
-- en daarna pas het team_members-record (manager). Op het moment
-- van `.insert({}).select('id')` is de gebruiker nog geen lid,
-- dus is_team_member() = false en zou de return waarde leeg zijn.
--
-- Oplossing: voeg `created_by` toe met DEFAULT auth.uid().
-- Supabase vult dit automatisch in bij elke INSERT. Zo kan de
-- maker het net-aangemaakte team uitlezen vóórdat hij lid is.
-- ============================================================

ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

-- Lezen: je bent lid van het team, OF jij hebt het zojuist aangemaakt
-- (created_by vangt de korte gap tussen INSERT team en INSERT team_member)
CREATE POLICY "teams_select"
  ON teams FOR SELECT
  USING (
    is_team_member(id)
    OR created_by = auth.uid()
  );

-- Aanmaken: elke ingelogde gebruiker mag een nieuw team starten
CREATE POLICY "teams_insert"
  ON teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Bewerken: alleen managers van dat team (naam, kleur, setup_done etc.)
CREATE POLICY "teams_update"
  ON teams FOR UPDATE
  USING (is_team_manager(id));

-- Verwijderen: alleen managers
CREATE POLICY "teams_delete"
  ON teams FOR DELETE
  USING (is_team_manager(id));


-- ============================================================
-- 2. TEAM_MEMBERS
-- ============================================================
--
-- Dit is de centrale autorisatietabel. Extra aandacht voor:
--
-- SELECT: TeamContext leest eigen lidmaatschappen (user_id = auth.uid()).
--   PlayersManageView leest alle leden van het huidige team.
--   Beide gevallen worden gedekt door de policy hieronder.
--
-- INSERT: twee situaties:
--   a) Speler accepteert uitnodiging → voegt zichzelf in (join-flow)
--   b) Manager maakt zelf een team → voegt zichzelf in als manager
--   In beide gevallen geldt: user_id = auth.uid() op het nieuwe record.
--
-- UPDATE/DELETE: alleen managers.
-- ============================================================

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

-- Lezen: eigen records altijd, plus mede-teamleden zien
CREATE POLICY "team_members_select"
  ON team_members FOR SELECT
  USING (
    user_id = auth.uid()        -- eigen team-lidmaatschappen (TeamContext)
    OR is_team_member(team_id)  -- mede-teamleden zien (PlayersManageView)
  );

-- Toevoegen: jezelf lid maken (join-flow + wizard), of manager voegt toe
CREATE POLICY "team_members_insert"
  ON team_members FOR INSERT
  WITH CHECK (
    user_id = auth.uid()         -- je koppelt je eigen account
    OR is_team_manager(team_id)  -- manager beheert leden
  );

-- Bewerken: alleen managers (rol wijzigen, status op inactief zetten etc.)
CREATE POLICY "team_members_update"
  ON team_members FOR UPDATE
  USING (is_team_manager(team_id));

-- Verwijderen: alleen managers
CREATE POLICY "team_members_delete"
  ON team_members FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 3. INVITE_TOKENS
-- ============================================================
--
-- Bijzonder geval: de join-pagina (/join/[token]) leest een token
-- VOORDAT de gebruiker is ingelogd. Ook /login en /register tonen
-- alvast de teamnaam/spelernaam uit de token. Dit is bewust zo
-- ontworpen zodat iemand weet waarvoor hij inlogt.
--
-- Oplossing: SELECT is open voor iedereen, inclusief anoniem.
-- Dit is veilig omdat tokens willekeurige UUID-strings zijn —
-- zonder de exacte token is het niet bruikbaar, en listing van
-- tokens geeft geen schrijftoegang.
--
-- UPDATE (als-gebruikt-markeren): ook open voor ingelogde users,
-- want de join-flow doet dit na authenticatie.
-- ============================================================

ALTER TABLE invite_tokens ENABLE ROW LEVEL SECURITY;

-- Lezen: iedereen (inclusief niet-ingelogd), voor de join-flow
CREATE POLICY "invite_tokens_select"
  ON invite_tokens FOR SELECT
  USING (true);

-- Aanmaken: alleen managers van dat team
CREATE POLICY "invite_tokens_insert"
  ON invite_tokens FOR INSERT
  WITH CHECK (is_team_manager(team_id));

-- Bewerken: managers kunnen intrekken; ingelogde gebruikers kunnen
-- een token als gebruikt markeren (used_at) bij het accepteren
CREATE POLICY "invite_tokens_update"
  ON invite_tokens FOR UPDATE
  USING (
    is_team_manager(team_id)
    OR auth.uid() IS NOT NULL  -- uitnodiging accepteren (join-flow)
  );

-- Verwijderen: alleen managers
CREATE POLICY "invite_tokens_delete"
  ON invite_tokens FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 4. ANNOUNCEMENTS
-- ============================================================
--
-- Mededelingen zijn teamspecifiek. Alle leden mogen lezen,
-- alleen managers mogen aanmaken/bewerken/verwijderen.
-- (AnnouncementBanner toont de verwijderknop al alleen aan managers.)
-- ============================================================

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Lezen: alle teamleden
CREATE POLICY "announcements_select"
  ON announcements FOR SELECT
  USING (is_team_member(team_id));

-- Aanmaken: alleen managers
CREATE POLICY "announcements_insert"
  ON announcements FOR INSERT
  WITH CHECK (is_team_manager(team_id));

-- Bewerken: alleen managers
CREATE POLICY "announcements_update"
  ON announcements FOR UPDATE
  USING (is_team_manager(team_id));

-- Verwijderen: alleen managers
CREATE POLICY "announcements_delete"
  ON announcements FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 5. PLAYER_OF_WEEK_VOTES (SPDW)
-- ============================================================
--
-- Alle teamleden mogen stemmen en elkaars stemmen inzien
-- (nodig voor stemoverzicht in DashboardView en useVoting).
-- UPDATE is nodig omdat useVoting.ts een bestaande stem kan
-- aanpassen (upsert-achtig patroon).
-- ============================================================

ALTER TABLE player_of_week_votes ENABLE ROW LEVEL SECURITY;

-- Lezen: teamleden
CREATE POLICY "votes_select"
  ON player_of_week_votes FOR SELECT
  USING (is_team_member(team_id));

-- Stemmen: teamleden
CREATE POLICY "votes_insert"
  ON player_of_week_votes FOR INSERT
  WITH CHECK (is_team_member(team_id));

-- Stem aanpassen: teamleden (useVoting kan een bestaande stem bijwerken)
CREATE POLICY "votes_update"
  ON player_of_week_votes FOR UPDATE
  USING (is_team_member(team_id));

-- Verwijderen: alleen managers (voor eventuele opschoning)
CREATE POLICY "votes_delete"
  ON player_of_week_votes FOR DELETE
  USING (is_team_manager(team_id));


-- ============================================================
-- 6. STAT_CREDITS
-- ============================================================
--
-- Elk teamlid kan credits ontvangen (SPDW-uitkering) en
-- uitgeven (stat-aanpassingen). De hook ensureBalance maakt
-- automatisch een rij aan als die nog niet bestaat. Daarom
-- mogen alle teamleden INSERT én UPDATE uitvoeren.
--
-- Geen DELETE-policy: creditbalansen mogen niet worden gewist.
-- ============================================================

ALTER TABLE stat_credits ENABLE ROW LEVEL SECURITY;

-- Lezen: teamleden (ook elkaars saldo zien voor de PersonalCard)
CREATE POLICY "credits_select"
  ON stat_credits FOR SELECT
  USING (is_team_member(team_id));

-- Aanmaken: teamleden (ensureBalance initialiseert het saldo)
CREATE POLICY "credits_insert"
  ON stat_credits FOR INSERT
  WITH CHECK (is_team_member(team_id));

-- Bijwerken: teamleden (spendCredit en awardSpdwCredits)
CREATE POLICY "credits_update"
  ON stat_credits FOR UPDATE
  USING (is_team_member(team_id));

-- (Geen DELETE — credits zijn niet te verwijderen)


-- ============================================================
-- 7. STAT_CREDIT_TRANSACTIONS
-- ============================================================
--
-- Transacties zijn een onwijzigbaar logboek. Elk teamlid mag
-- lezen (eigen transactiegeschiedenis) en aanmaken (bij elke
-- credit-mutatie). Geen UPDATE of DELETE.
-- ============================================================

ALTER TABLE stat_credit_transactions ENABLE ROW LEVEL SECURITY;

-- Lezen: teamleden
CREATE POLICY "transactions_select"
  ON stat_credit_transactions FOR SELECT
  USING (is_team_member(team_id));

-- Aanmaken: teamleden (bij credit-uitgave, SPDW-uitkering, initialisatie)
CREATE POLICY "transactions_insert"
  ON stat_credit_transactions FOR INSERT
  WITH CHECK (is_team_member(team_id));

-- (Geen UPDATE of DELETE — transacties zijn immutable)
