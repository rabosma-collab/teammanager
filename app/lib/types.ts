export interface Player {
    id: number;
    name: string;
    position: string;
    goals: number;
    assists: number;
    was: number;
    min: number;
    injured: boolean;
    is_guest?: boolean;
    guest_match_id?: number;
  }
  
  export interface Match {
    id: number;
    date: string;
    opponent: string;
    home_away: string;
    formation: string;
  }
  
  export interface Substitution {
    id: number;
    match_id: number;
    substitution_number: number;
    minute: number;
    player_out_id: number;
    player_in_id: number;
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