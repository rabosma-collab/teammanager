import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { access_token } = await req.json();
  if (!access_token) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  // Service-role client — ook gebruikt om token te verifiëren
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(access_token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  // 1. Anonimiseer spelerdata + verwijder team_members via RPC
  //    (RPC controleert zelf dat auth.uid() == p_user_id)
  const { error: rpcError } = await supabaseAdmin.rpc('anonymize_user_data', {
    p_user_id: user.id,
  });
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 });
  }

  // 2. Verwijder avatar-bestanden uit Storage
  const { data: files } = await supabaseAdmin.storage
    .from('avatars')
    .list(`users/${user.id}`);
  if (files && files.length > 0) {
    const paths = files.map(f => `users/${user.id}/${f.name}`);
    await supabaseAdmin.storage.from('avatars').remove(paths);
  }

  // 3. Verwijder het Supabase Auth-account (vereist service_role)
  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
