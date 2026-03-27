import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const resend = new Resend(process.env.RESEND_API_KEY);

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

  const { teamName, managerEmail, teamId } = await req.json();

  if (!teamName || !teamId) {
    return NextResponse.json({ error: 'Velden ontbreken' }, { status: 400 });
  }

  const supabaseUrl = process.env.SUPABASE_DASHBOARD_URL ?? 'https://supabase.com/dashboard';

  const { error } = await resend.emails.send({
    from: 'Team Manager <onboarding@resend.dev>',
    to: process.env.ADMIN_NOTIFY_EMAIL!,
    subject: `Nieuw teamverzoek: ${teamName}`,
    html: `
      <h2>Nieuw teamverzoek</h2>
      <p>Er is een nieuw team aangemeld dat wacht op goedkeuring:</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:4px 12px 4px 0;color:#666">Teamnaam</td><td><strong>${teamName}</strong></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#666">Team ID</td><td><code>${teamId}</code></td></tr>
        ${managerEmail ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Manager</td><td>${managerEmail}</td></tr>` : ''}
      </table>
      <p>Keur het team goed door in Supabase de status op <code>active</code> te zetten:</p>
      <pre style="background:#f4f4f4;padding:12px;border-radius:4px;font-size:13px">UPDATE teams SET status = 'active' WHERE id = '${teamId}';</pre>
      <p><a href="${supabaseUrl}" style="color:#3b82f6">Open Supabase SQL Editor</a></p>
    `,
  });

  if (error) {
    console.error('Resend error:', error);
    return NextResponse.json({ error: 'Mail versturen mislukt' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
