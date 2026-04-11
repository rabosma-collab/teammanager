import { supabase } from './supabase';

function normalizeName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function resolveCurrentTeamMemberName(
  teamId: string,
  userId: string | null,
  currentPlayerId?: number | null,
): Promise<string> {
  if (userId) {
    const { data: member } = await supabase
      .from('team_members')
      .select('display_name, player_id')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle();

    const displayName = normalizeName(member?.display_name);
    if (displayName) return displayName;

    const linkedPlayerId = member?.player_id ?? currentPlayerId ?? null;
    if (linkedPlayerId != null) {
      const { data: player } = await supabase
        .from('players')
        .select('name')
        .eq('id', linkedPlayerId)
        .maybeSingle();

      const playerName = normalizeName(player?.name);
      if (playerName) return playerName;
    }
  }

  const { data: { user } } = await supabase.auth.getUser();
  const fullName = normalizeName(user?.user_metadata?.full_name);
  if (fullName) return fullName;

  const metadataDisplayName = normalizeName(user?.user_metadata?.display_name);
  if (metadataDisplayName) return metadataDisplayName;

  const email = normalizeName(user?.email);
  if (email) return email;

  return 'Manager';
}