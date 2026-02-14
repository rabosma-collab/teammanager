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
    is_guest?: boolean;
    guest_match_id?: number;
  }

  export interface Match {
    id: number;
    date: string;
    opponent: string;
    home_away: string;
    formation: string;
    substitution_scheme_id: number;
    match_status: 'concept' | 'afgerond';
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