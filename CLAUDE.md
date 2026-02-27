# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint (next/core-web-vitals)
npx tsc --noEmit     # TypeScript type check (no test framework configured)
```

## Architecture

Single-page Next.js 13 app (App Router) with client-side rendering. All UI runs client-side via `"use client"` in `app/page.tsx`. Backend is Supabase (PostgreSQL + Auth + Storage).

### Key Patterns

- **State management**: No external library. Custom hooks in `app/hooks/` handle Supabase CRUD and local state. Props drilling from `page.tsx` to components.
- **Stale fetch cancellation**: `fetchIdRef` pattern (useRef counter) in hooks to discard outdated async responses.
- **Player deduplication**: Multiple safety layers (by ID via Map, by name via Set) in `usePlayers.ts`, `page.tsx`, and `BenchPanel.tsx` to prevent duplicate rendering.
- **React StrictMode**: Intentionally disabled in `next.config.js` to avoid double-effect issues with the dedup/fetch logic.
- **Supabase client**: Use the singleton `supabase` from `app/lib/supabase.ts` in components. `createClientComponentClient()` creates a new instance each call — only use that in `TeamContext.tsx` where it already exists.

### Data Flow

`page.tsx` (FootballApp) is the orchestrator:
1. `TeamContext` (`app/contexts/TeamContext.tsx`) provides identity: `currentTeam`, `isManager`, `currentPlayerId`, `teams`, `switchTeam`
2. Hooks (`usePlayers`, `useMatches`, `useLineup`, `useSubstitutions`, `useInstructions`, `useSubstitutionSchemes`, `useStatCredits`, `useVoting`, `useTeamSettings`) fetch from Supabase
3. `page.tsx` computes derived state via `useMemo` (benchPlayers, groupedPlayers, unavailablePlayers)
4. Components receive data + callbacks via props
5. Modals in `app/components/modals/` handle forms for CRUD operations

### Admin Authentication

Role-based via Supabase `team_members.role`. No hardcoded passwords.

- `isManager` from `useTeamContext()` — true when `team_members.role = 'manager'`
- `isStaff` from `useTeamContext()` — true when `team_members.role = 'staff'`
- Admin gates: player/match management, lineup editing, substitutions, instructions, injury/absence toggles, invites, announcements, team settings

### User ↔ Player Linking

- `team_members` table links `user_id` (Supabase auth) → `player_id` (players table)
- Populated automatically when invite link is accepted (`app/join/[token]/page.tsx`)
- `TeamContext` exposes `currentPlayerId: number | null` — null for managers without player record

### Views & Navigation

- **Dashboard** (default): `DashboardView.tsx` — personal card, next match, squad availability, voting, announcements
- **Wedstrijd**: `PitchView.tsx` — pitch visualization, drag-drop lineup, bench, substitutions
- **Spelerskaarten**: `PlayerCardsView.tsx` — player cards with stat editing (uses credits)
- **Stats**: `PlayerStatsView.tsx` / `StatsView.tsx`
- **Beheer** (admin dropdown): PlayersManageView, MatchesManageView, InvitesManageView, InstructionsView, MededelingenView, TeamSettingsView

### Core Types (`app/lib/types.ts`)

- `Player` — includes match stats (goals, assists, min) and FIFA stats (pac, sho, pas, dri, def); goalkeeper has (div, han, kic, ref, spe, pos); also `avatar_url`
- `Match` — date, opponent, home_away, formation, substitution_scheme_id, match_status (concept/afgerond), goals_for, goals_against, lineup_published
- `SubstitutionScheme` — name, minutes[] (empty array = free substitution), is_system
- `Substitution` — includes custom_minute for free substitution schemes, is_extra
- `Team` — id (uuid), name, slug, team_size, color, setup_done
- `TeamSettings` — default_formation, match_duration, feature toggles (track_goals, track_assists, track_minutes, track_cards, track_clean_sheets, track_spdw, track_results)
- `TeamMember` — user_id, team_id, player_id, role (manager/player/staff), status
- `PositionInstruction`, `TempSubstitution`, `Vote`, `VotingMatch`, `SpdwResult`

### Formations (`app/lib/constants.ts`)

Six predefined formations (4-3-3-aanvallend, 4-3-3-verdedigend, 4-4-2-plat, 4-4-2-ruit, 3-4-3, 5-3-2) with pixel coordinates for pitch visualization. Four position categories: Keeper, Verdediger, Middenvelder, Aanvaller.

### Supabase Tables

| Table | Purpose |
|-------|---------|
| `players` | Team roster (stats, FIFA attrs, avatar_url) |
| `guest_players` | One-off players per match |
| `matches` | Match scheduling + results (goals_for, goals_against) |
| `lineups` | Player-position assignments per match |
| `substitutions` | In-game substitutions |
| `substitution_schemes` | Substitution timing rules |
| `match_absences` | Player unavailability per match |
| `position_instructions` | Formation-based position tips |
| `match_position_instructions` | Match-specific instruction overrides |
| `player_of_week_votes` | SPDW voting records |
| `stat_credits` | Credit balance per player per team |
| `stat_credit_transactions` | Credit audit log |
| `teams` | Team records (id is **uuid**) |
| `team_members` | User ↔ Team ↔ Player links (role, status) |
| `team_settings` | Feature toggles per team |
| `invite_tokens` | Invite links (player/staff) |
| `announcements` | Team announcements |

Supabase Storage bucket `avatars` — public read, for profile pictures.

### Supabase DB Notes

- `teams.id` is **uuid** — always use `uuid` type for FK to teams (not text)
- `players.id` is integer
- `matches.id` is integer (bigint)

### Hooks (`app/hooks/`)

| Hook | Purpose |
|------|---------|
| `usePlayers` | Player CRUD, guest players, deduplication |
| `useMatches` | Match CRUD, absence toggle, score tracking |
| `useLineup` | Lineup management |
| `useSubstitutions` | Substitution CRUD |
| `useSubstitutionSchemes` | Fetch schemes |
| `useInstructions` | Position instructions |
| `useTeamSettings` | Team feature toggles |
| `useStatCredits` | Credit balance, transactions, SPDW payout logic |
| `useVoting` | SPDW voting: cast votes, get results |

### Key Features

- **Multi-team support**: Users can belong to multiple teams with different roles. Team switcher in Navbar.
- **Team setup wizard**: `app/team/new/page.tsx` → `TeamSetupWizard.tsx` (6 steps).
- **Profile system**: `ProfileModal.tsx` — avatar upload to Supabase Storage, name/email/password change.
- **Stat credits (SPDW)**: Players earn credits by voting; spend credits to edit FIFA stats. `useStatCredits.ts`.
- **Lineup published flag**: `matches.lineup_published` — controls visibility to non-managers.

## Language

All UI text is in Dutch. Position names: Keeper, Verdediger, Middenvelder, Aanvaller.
