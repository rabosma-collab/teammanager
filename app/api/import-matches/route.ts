import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Model met beeldherkenning (vision), gratis tier.
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Max grootte van de (base64) afbeelding die we accepteren (~5 MB ruw = ~6.8 MB base64).
const MAX_BASE64_LENGTH = 7 * 1024 * 1024;

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

/** Eén herkende wedstrijd zoals Gemini die teruggeeft. */
interface ParsedMatch {
  date: string | null;
  opponent: string | null;
  home_away: 'Thuis' | 'Uit' | null;
  match_time: string | null;
  location_details: string | null;
}

function buildPrompt(teamName: string): string {
  return [
    `Je krijgt een screenshot van een KNVB-wedstrijdschema (voetbal).`,
    `Het team van de gebruiker heet: "${teamName}".`,
    ``,
    `Lees ALLE wedstrijden uit de afbeelding en geef ze terug als JSON.`,
    `Regels:`,
    `- Elke wedstrijd heeft twee ploegen. De tegenstander is de ploeg die NIET "${teamName}" is.`,
    `- Als "${teamName}" als eerste/thuisploeg staat, is home_away "Thuis"; anders "Uit".`,
    `- date in formaat YYYY-MM-DD. Als het jaar ontbreekt, kies het meest logische seizoensjaar.`,
    `- match_time in formaat HH:MM (24-uurs). Laat null als niet zichtbaar.`,
    `- location_details: veld/locatie indien zichtbaar, anders null.`,
    `- opponent: alleen de naam van de tegenstander (zonder "${teamName}").`,
    `- Verzin niets. Laat een veld null als je het niet zeker uit de afbeelding kunt lezen.`,
    ``,
    `Geef UITSLUITEND een JSON-object terug met de vorm:`,
    `{ "matches": [ { "date": "YYYY-MM-DD", "opponent": "string", "home_away": "Thuis"|"Uit"|null, "match_time": "HH:MM"|null, "location_details": "string"|null } ] }`,
  ].join('\n');
}

/** Normaliseer een datum-string naar ISO (YYYY-MM-DD) of null. */
function normalizeDate(raw: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  // Al ISO?
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // dd-mm-yyyy of dd/mm/yyyy
  const m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = `20${y}`;
    const dd = d.padStart(2, '0');
    const mm = mo.padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

/** Normaliseer tijd naar HH:MM of null. */
function normalizeTime(raw: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.trim().match(/^(\d{1,2})[:.](\d{2})/);
  if (!m) return null;
  const hh = m[1].padStart(2, '0');
  return `${hh}:${m[2]}`;
}

export async function POST(req: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY ontbreekt');
    return NextResponse.json(
      { error: 'Screenshot-import is nog niet geconfigureerd. Neem contact op met de beheerder.' },
      { status: 503 }
    );
  }

  let body: { imageBase64?: string; mimeType?: string; teamName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Ongeldige aanvraag' }, { status: 400 });
  }

  const { imageBase64, mimeType, teamName } = body;

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return NextResponse.json({ error: 'Geen afbeelding ontvangen' }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: 'Afbeelding is te groot (max 5 MB)' }, { status: 400 });
  }
  const mime = (mimeType || '').toLowerCase();
  if (!ALLOWED_MIME.includes(mime)) {
    return NextResponse.json({ error: 'Ongeldig afbeeldingstype' }, { status: 400 });
  }

  const prompt = buildPrompt((teamName || '').trim() || 'ons team');

  let geminiRes: Response;
  try {
    geminiRes = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mime, data: imageBase64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
    });
  } catch (err) {
    console.error('Gemini niet bereikbaar:', err);
    return NextResponse.json(
      { error: 'De beeldherkenning is tijdelijk niet bereikbaar. Probeer het later opnieuw.' },
      { status: 502 }
    );
  }

  if (!geminiRes.ok) {
    const detail = await geminiRes.text().catch(() => '');
    console.error('Gemini fout:', geminiRes.status, detail);
    return NextResponse.json(
      { error: 'De screenshot kon niet worden verwerkt. Probeer het opnieuw.' },
      { status: 502 }
    );
  }

  let text: string | undefined;
  try {
    const data = await geminiRes.json();
    text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch (err) {
    console.error('Gemini JSON parse-fout:', err);
    return NextResponse.json({ error: 'Onverwacht antwoord van de beeldherkenning.' }, { status: 502 });
  }

  if (!text) {
    return NextResponse.json({ matches: [] });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Soms zit er tekst omheen; probeer het JSON-object eruit te vissen.
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ matches: [] });
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return NextResponse.json({ matches: [] });
    }
  }

  const rawMatches = (parsed as { matches?: unknown })?.matches;
  if (!Array.isArray(rawMatches)) {
    return NextResponse.json({ matches: [] });
  }

  const matches: ParsedMatch[] = rawMatches
    .filter((m): m is Record<string, unknown> => !!m && typeof m === 'object')
    .map((m) => {
      const homeAway = m.home_away === 'Thuis' || m.home_away === 'Uit' ? m.home_away : null;
      return {
        date: normalizeDate(typeof m.date === 'string' ? m.date : null),
        opponent: typeof m.opponent === 'string' ? m.opponent.trim() || null : null,
        home_away: homeAway as 'Thuis' | 'Uit' | null,
        match_time: normalizeTime(typeof m.match_time === 'string' ? m.match_time : null),
        location_details:
          typeof m.location_details === 'string' ? m.location_details.trim() || null : null,
      };
    })
    // Rijen zonder enige bruikbare inhoud weglaten
    .filter((m) => m.date || m.opponent);

  return NextResponse.json({ matches });
}
