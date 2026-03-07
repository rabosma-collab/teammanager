-- ============================================================
-- delete_account.sql
--
-- RPC-functie voor accountverwijdering door de gebruiker zelf.
-- Anonimiseert spelerdata (naam + avatar) en verwijdert de
-- team_members-koppeling. Het verwijderen van het auth-account
-- zelf gebeurt server-side via de Next.js API-route
-- /api/delete-account (vereist service_role key).
--
-- Aanpak:
--   - Naam wordt vervangen door 'Verwijderd account'
--   - avatar_url wordt leeggemaakt
--   - Statistieken (goals, assists etc.) blijven anoniem bewaard
--     voor de integriteit van de teamhistorie
--   - team_members-rijen worden verwijderd (geen toegang meer)
--
-- HOE UITVOEREN:
--   Plak dit script in de Supabase SQL Editor en voer het uit.
-- ============================================================

CREATE OR REPLACE FUNCTION public.anonymize_user_data(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Controleer dat de aanvrager alleen zijn eigen account anonimiseert
  IF auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: can only delete your own account';
  END IF;

  -- Anonimiseer alle spelerrecords die aan deze gebruiker gekoppeld zijn
  UPDATE players
  SET name = 'Verwijderd account',
      avatar_url = NULL
  WHERE id IN (
    SELECT player_id
    FROM team_members
    WHERE user_id = p_user_id
      AND player_id IS NOT NULL
  );

  -- Verwijder de team-koppelingen (geen toegang meer tot teams)
  DELETE FROM team_members WHERE user_id = p_user_id;
END;
$$;
