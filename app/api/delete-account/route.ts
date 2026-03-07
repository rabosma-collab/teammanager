import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  const cookieStore = cookies();

  // Haal de ingelogde user op via de sessie-cookie (anon key is veilig hier)
  const supabaseUser = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* read-only in deze route */ },
      },
    }
  );

  const { data: { user } } = await supabaseUser.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 });
  }

  // Service-role client voor admin-operaties (verwijdert auth-account)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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
