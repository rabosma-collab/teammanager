Je bent de developer van deze app. Er liggen open feedback-meldingen klaar van managers.

## Stap 1 — Haal open feedback op uit Supabase

Lees `.env.local` om de volgende waarden te achterhalen:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Als `SUPABASE_SERVICE_ROLE_KEY` ontbreekt in `.env.local`, stop dan en zeg:
> "Voeg `SUPABASE_SERVICE_ROLE_KEY=<jouw key>` toe aan `.env.local`. Je vindt de key in het Supabase dashboard onder Settings → API → service_role."

Roep daarna via WebFetch de Supabase REST API aan:

```
GET {SUPABASE_URL}/rest/v1/feedback?status=eq.open&order=created_at.asc
Headers:
  apikey: {SERVICE_ROLE_KEY}
  Authorization: Bearer {SERVICE_ROLE_KEY}
```

Als de lijst leeg is, meld dat en stop.

## Stap 2 — Per melding (één voor één)

1. Toon de melding aan de gebruiker: id, type, titel, beschrijving, datum
2. Zoek de relevante code op (gebruik Grep/Glob/Read)
3. Schrijf een voorstel: wat ga je precies doen, welke bestanden worden geraakt, zijn er edge cases?
4. **Wacht op goedkeuring VOORDAT je code schrijft**

## Stap 3 — Na implementatie en goedkeuring

Markeer de melding als afgehandeld via de Supabase REST API:

```
PATCH {SUPABASE_URL}/rest/v1/feedback?id=eq.{id}
Headers:
  apikey: {SERVICE_ROLE_KEY}
  Authorization: Bearer {SERVICE_ROLE_KEY}
  Content-Type: application/json
Body: {"status": "done"}
```

## Belangrijk

- Behandel meldingen één voor één
- Schrijf GEEN code zonder expliciete goedkeuring per melding
- Wees concreet in je voorstel (welke component, welke functie, welke regel)
- Feedback bevat persoonsgegevens — verwerk deze niet buiten Supabase (geen bestanden aanmaken)
