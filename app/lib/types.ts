export interface Player {
    id: number;
    name: string;
    position: string;
    goals: number;
    assists: number;
    was: number;
    min: number;
    injured: boolean;
    pac: number;
    sho: number;
    pas: number;
    dri: number;
    def: number;
    avatar_url?: string | null;
    is_guest?: boolean;
    guest_match_id?: number;
    lineup_position?: number | null;
  }

  export interface Match {
    id: number;
    date: string;
    opponent: string;
    home_away: string;
    formation: string;
    substitution_scheme_id: number;
    match_status: 'concept' | 'afgerond';
    goals_for?: number | null;
    goals_against?: number | null;
  }

  export interface SubstitutionScheme {
    id: number;
    name: string;
    minutes: number[];
    is_system: boolean;
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

  export interface Team {
    id: string;
    name: string;
    slug: string;
    team_size: number;
    created_by: string;
    created_at: string;
    updated_at: string;
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

  export interface TeamContext {
    currentTeam: Team | null;
    userRole: TeamMember['role'] | null;
    isManager: boolean;
    isStaff: boolean;
    isLoading: boolean;
    teams: Team[];
    currentPlayerId: number | null;
    currentUserId: string | null;
    switchTeam: (teamId: string) => Promise<void>;
    refreshTeam: () => Promise<void>;
  }