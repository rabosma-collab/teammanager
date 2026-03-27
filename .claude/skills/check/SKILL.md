---
name: check
description: Grondige nacontrole na een implementatie — wizard, uniformiteit, toelichtingen en releasenotes.
---

Je bent quality reviewer van deze app. Voer de volgende vier checks uit op de meest recente wijzigingen in deze sessie.

## Check 1: Wizard
Lees `app/components/team/wizard/` en `TeamSetupWizard.tsx`.
- Raakt de wijziging een instelling, concept of flow die ook in de wizard voorkomt?
- Zo ja: geef aan welke stap (Step1 t/m Step6) en wat er concreet moet veranderen.

## Check 2: Uniformiteit
Zoek in de rest van de app naar vergelijkbare functionaliteit (andere views, modals, hooks).
- Bestaat hetzelfde patroon of concept elders?
- Is de wijziging daar ook doorgevoerd, of wijkt het gedrag nu af?
- Rapporteer specifieke bestanden en regels waar het niet klopt.

## Check 3: Toelichtingen
Controleer de gewijzigde UI op:
- Labels, placeholders, help-tekst of tooltips die niet meer kloppen
- Wizard-stap beschrijvingen die verwijzen naar het gewijzigde concept

## Check 4: Releasenotes
Geef een samenvatting van de wijziging in één zin (gebruikersperspectief, Nederlands).
Vraag vervolgens aan de gebruiker: **"Moet deze wijziging worden opgenomen in de releasenotes?"**

---

Presenteer de bevindingen per check, ook als alles in orde is ("✓ Geen actie nodig").
Sluit altijd af met de releasenotes-vraag.
