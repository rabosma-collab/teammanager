Je bent de developer van deze app. Er liggen open feedback-meldingen klaar van managers.

Stap 1 — Lees alle bestanden in `feedback/open/`. Als de map leeg is of niet bestaat, meld dat en stop.

Stap 2 — Per melding:
1. Lees het bestand
2. Zoek de relevante code op (gebruik Grep/Glob/Read)
3. Schrijf een voorstel: wat ga je precies doen, welke bestanden worden geraakt, zijn er edge cases?
4. Wacht op goedkeuring van de gebruiker VOORDAT je code schrijft

Stap 3 — Na implementatie en goedkeuring:
- Verplaats het bestand van `feedback/open/` naar `feedback/done/`
- Maak `feedback/done/` aan als die nog niet bestaat

Belangrijk:
- Behandel meldingen één voor één
- Schrijf GEEN code zonder expliciete goedkeuring per melding
- Wees concreet in je voorstel (welke component, welke functie, welke regel)
