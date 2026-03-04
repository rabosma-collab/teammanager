-- Activity log: team-wide event feed
create table if not exists activity_log (
  id          bigserial primary key,
  team_id     uuid not null references teams(id) on delete cascade,
  type        text not null,
  actor_id    int references players(id) on delete set null,
  subject_id  int references players(id) on delete set null,
  match_id    bigint references matches(id) on delete set null,
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_team_created on activity_log(team_id, created_at desc);

-- Per-user, per-item read tracking
create table if not exists activity_log_reads (
  user_id     uuid not null references auth.users(id) on delete cascade,
  activity_id bigint not null references activity_log(id) on delete cascade,
  primary key (user_id, activity_id)
);

-- RLS: activity_log
alter table activity_log enable row level security;

-- Alle leden van het team mogen lezen
create policy "Team members can read activity" on activity_log
  for select using (
    exists (
      select 1 from team_members
      where team_members.team_id = activity_log.team_id
        and team_members.user_id = auth.uid()
        and team_members.status = 'active'
    )
  );

-- Alleen insert via service role (logActivity wordt server-side of met auth aangeroepen)
-- In de client loggen we via de ingelogde gebruiker; we staan insert toe voor actieve leden
create policy "Team members can insert activity" on activity_log
  for insert with check (
    exists (
      select 1 from team_members
      where team_members.team_id = activity_log.team_id
        and team_members.user_id = auth.uid()
        and team_members.status = 'active'
    )
  );

-- Update mag voor spam-deduplicatie (zelfde rij bijwerken)
create policy "Team members can update own activity" on activity_log
  for update using (
    exists (
      select 1 from team_members
      where team_members.team_id = activity_log.team_id
        and team_members.user_id = auth.uid()
        and team_members.status = 'active'
    )
  );

-- RLS: activity_log_reads
alter table activity_log_reads enable row level security;

create policy "Users manage own reads" on activity_log_reads
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
