import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ALLOWED_TYPES = ['bug', 'wens'] as const;

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

  const { type, title, description } = await req.json();

  if (!type || !title || !description) {
    return NextResponse.json({ error: 'Velden ontbreken' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(type as (typeof ALLOWED_TYPES)[number])) {
    return NextResponse.json({ error: 'Ongeldig type' }, { status: 400 });
  }

  const { error } = await supabase
    .from('feedback')
    .insert({ type, title, description, user_id: user.id });

  if (error) {
    console.error('Feedback opslaan mislukt:', error);
    return NextResponse.json({ error: 'Opslaan mislukt' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
