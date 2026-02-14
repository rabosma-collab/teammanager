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

Single-page Next.js 13 app (App Router) with client-side rendering. All UI runs client-side via `"use client"` in `app/page.tsx`. Backend is Supabase (PostgreSQL).

### Key Patterns

- **State management**: No external library. Custom hooks in `app/hooks/` handle Supabase CRUD and local state. Props drilling from `page.tsx` to components.
- **Stale fetch cancellation**: `fetchIdRef` pattern (useRef counter) in hooks to discard outdated async responses.
- **Player deduplication**: Multiple safety layers (by ID via Map, by name via Set) in `usePlayers.ts`, `page.tsx`, and `BenchPanel.tsx` to prevent duplicate rendering.
- **React StrictMode**: Intentionally disabled in `next.config.js` to avoid double-effect issues with the dedup/fetch logic.

### Data Flow

`page.tsx` (FootballApp) is the orchestrator:
1. Hooks (`usePlayers`, `useMatches`, `useLineup`, `useSubstitutions`, `useInstructions`, `useSubstitutionSchemes`) fetch from Supabase
2. `page.tsx` computes derived state via `useMemo` (benchPlayers, groupedPlayers, unavailablePlayers)
3. Components receive data + callbacks via props
4. Modals in `app/components/modals/` handle forms for CRUD operations

### Core Types (`app/lib/types.ts`)

- `Player` — includes match stats (goals, assists, was, min) and FIFA stats (pac, sho, pas, dri, def)
- `Match` — date, opponent, home_away, formation, substitution_scheme_id, match_status (concept/afgerond)
- `SubstitutionScheme` — name, minutes[] (empty array = free substitution), is_system
- `Substitution` — includes custom_minute for free substitution schemes
- `PositionInstruction`, `TempSubstitution`

### Formations (`app/lib/constants.ts`)

Six predefined formations (4-3-3-aanvallend, 4-3-3-verdedigend, 4-4-2-plat, 4-4-2-ruit, 3-4-3, 5-3-2) with pixel coordinates for pitch visualization. Four position categories: Keeper, Verdediger, Middenvelder, Aanvaller.

### Supabase Tables

`players`, `guest_players`, `matches`, `lineups`, `substitutions`, `substitution_schemes`, `match_absences`, `position_instructions`. Client initialized in `app/lib/supabase.js` with public anon key.

### Admin Authentication

Hardcoded password check (`"swenenrobin"`). Admin gates: player/match management, lineup editing, substitutions, instructions, injury/absence toggles.

## Language

All UI text is in Dutch. Position names: Keeper, Verdediger, Middenvelder, Aanvaller.
