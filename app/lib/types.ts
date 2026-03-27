export interface Player {
    id: number;
    name: string;
    position: string;
    goals: number;
    assists: number;
    wash_count: number;
    consumption_count: number;
    transport_count: number;
    yellow_cards: number;
    red_cards: number;
    own_goals?: number;
    min: number;
    played_min: number;
    injured: boolean;
    pac: number;
    sho: number;
    pas: number;
    dri: number;
    def: number;
    phy?: number;
    div?: number;
    han?: number;
    kic?: number;
    ref?: number;
    spe?: number;
    pos?: number;
    avatar_url?: string | null;
    bonus_wins?: number;
    bonus_draws?: number;
    is_guest?: boolean;
    guest_match_id?: number;
    lineup_position?: number | null;
  }

  export interface Match {
    id: number;
    date: string;
    opponent: string;
    home_away: 'Thuis' | 'Uit';
    formation: string;
    match_type: 'competitie' | 'oefenwedstrijd';
    substitution_scheme_id: number;
    sub_moments?: number | null;
    match_status: 'concept' | 'afgerond' | 'geannuleerd';
    goals_for?: number | null;
    goals_against?: number | null;
    lineup_published?: boolean;
    credits_awarded?: boolean;
    wasbeurt_player_id?: number | null;
    consumpties_player_id?: number | null;
    transport_player_ids?: number[];
    assembly_time?: string | null;
    match_time?: string | null;
    location_details?: string | null;
    season_id?: number | null;
    match_report?: string | null;
  }

  export interface SubstitutionScheme {
    id: number;
    name: string;
    minutes: number[];
    is_system: boolean;
    team_id?: string | null;
  }

  export interface Substitution {
    id: number;
    match_id: number;
    substitution_number: number;
    minute: number;
    player_out_id: number;
    player_in_id: number;
    custom_minute: number | null;
    is_extra: boolean;
  }

  export interface PositionInstruction {
    id: number;
    game_format?: string;
    formation: string;
    position_index: number;
    position_name: string;
    title: string;
    general_tips: string[];
    with_ball: string[];
    without_ball: string[];
  }

  export interface TempSubstitution {
    out: Player | null;
    in: Player | null;
  }

  export interface Vote {
    id: string;
    match_id: number;
    voter_player_id: number;
    voted_for_player_id: number;
    voted_at: string;
  }

  export interface VoteResults {
    player_id: number;
    player_name: string;
    vote_count: number;
  }

  export interface VotingMatch {
    match: Match;
    players: Array<{ id: number; name: string }>;
    votes: VoteResults[];
    hasVoted: boolean;
    votedFor?: number;
    daysRemaining: number;
  }

  export interface SpdwPodiumEntry {
    rank: number;
    player_id: number;
    player_name: string;
    vote_count: number;
    credits: number;
  }

  export interface SpdwResult {
    match: Match;
    podium: SpdwPodiumEntry[];
  }

  export interface Team {
    id: string;
    name: string;
    slug: string;
    team_size: number;
    color: string;
    setup_done: boolean;
    status: 'pending' | 'active' | 'rejected';
    created_at: string;
    updated_at: string;
  }

  export type PlayerCardMode = 'competitive' | 'teamsterren' | 'none';

  export interface TeamSettings {
    team_id: string;
    game_format: string;
    periods: number;
    default_formation: string;
    match_duration: number;
    track_goals: boolean;
    track_assists: boolean;
    track_minutes: boolean;
    track_cards: boolean;
    track_clean_sheets: boolean;
    track_spdw: boolean;
    track_results: boolean;
    track_wasbeurt: boolean;
    track_consumpties: boolean;
    track_vervoer: boolean;
    vervoer_count: number;
    track_assembly_time: boolean;
    track_match_time: boolean;
    track_location_details: boolean;
    track_played_minutes: boolean;
    player_card_mode: PlayerCardMode;
    spdw_enabled: boolean;
    allow_edit_others: boolean;
  }

  export interface TeamMember {
    id: string;
    team_id: string;
    user_id: string;
    player_id?: number | null;
    role: 'manager' | 'player' | 'staff';
    status: 'active' | 'pending' | 'inactive';
    joined_at: string;
    invited_by: string | null;
  }

  export interface MatchPlayerStats {
    id?: number;
    match_id: number;
    team_id: string;
    player_id: number | null;
    guest_player_id: number | null;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
    own_goals: number;
    // Denormalized for display convenience (not in DB)
    player_name?: string;
  }

  export interface MatchWithStats extends Match {
    stats?: MatchPlayerStats[];
  }

  export interface Season {
    id: number;
    team_id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
  }

  export interface PlayerSeasonStats {
    id?: number;
    player_id: number;
    season_id: number;
    team_id: string;
    goals: number;
    assists: number;
    yellow_cards: number;
    red_cards: number;
    own_goals: number;
    min: number;
    wash_count: number;
    consumption_count: number;
    transport_count: number;
  }

  export interface TeamContext {
    currentTeam: Team | null;
    userRole: TeamMember['role'] | null;
    isManager: boolean;
    isStaff: boolean;
    isLoading: boolean;
    teams: Team[];
    hasPendingTeam: boolean;
    currentPlayerId: number | null;
    currentUserId: string | null;
    teamSettings: TeamSettings | null;
    switchTeam: (teamId: string) => Promise<void>;
    refreshTeam: () => Promise<void>;
    refreshTeamSettings: () => Promise<void>;
  }