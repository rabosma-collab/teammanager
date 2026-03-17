import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
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

  const datum = new Date().toISOString().slice(0, 10);
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '');
  const filename = `${datum}-${type}-${slug}.md`;

  const content = `---
type: ${type}
datum: ${datum}
---

# ${title}

${description}
`;

  const dir = path.resolve(process.cwd(), 'feedback', 'open');
  const filePath = path.resolve(dir, filename);

  // Path traversal guard
  if (!filePath.startsWith(dir + path.sep)) {
    return NextResponse.json({ error: 'Ongeldige bestandsnaam' }, { status: 400 });
  }

  await mkdir(dir, { recursive: true });
  await writeFile(filePath, content, 'utf-8');

  return NextResponse.json({ ok: true, filename });
}
