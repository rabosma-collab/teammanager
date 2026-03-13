import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  const { type, title, description } = await req.json();

  if (!type || !title || !description) {
    return NextResponse.json({ error: 'Velden ontbreken' }, { status: 400 });
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

  const dir = path.join(process.cwd(), 'feedback', 'open');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), content, 'utf-8');

  return NextResponse.json({ ok: true, filename });
}
