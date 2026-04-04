import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Ongeldig verzoek' }, { status: 400 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // filter bestaat wel in de runtime-API maar ontbreekt in de TypeScript-types van deze versie
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin.auth.admin.listUsers as any)({
    filter: email,
    perPage: 10,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const user = (data?.users ?? []).find(
    (u: { email?: string }) => u.email === email
  ) ?? null;

  if (!user) {
    // Gebruiker niet gevonden — geen info weggeven; behandel als normaal
    return NextResponse.json({ provider: 'unknown' });
  }

  const identities: { provider: string }[] = user.identities ?? [];
  const hasEmail = identities.some((i) => i.provider === 'email');
  const hasGoogle = identities.some((i) => i.provider === 'google');

  if (hasGoogle && !hasEmail) {
    return NextResponse.json({ provider: 'google' });
  }

  return NextResponse.json({ provider: 'email' });
}
