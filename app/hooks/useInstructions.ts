import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { PositionInstruction } from '../lib/types';
import { useFetchGuard } from './useFetchGuard';

export function useInstructions() {
  const [positionInstructions, setPositionInstructions] = useState<PositionInstruction[]>([]);
  const [matchInstructions, setMatchInstructions] = useState<PositionInstruction[]>([]);
  const [editingInstruction, setEditingInstruction] = useState<PositionInstruction | null>(null);
  const instructionsGuard = useFetchGuard();
  const matchInstructionsGuard = useFetchGuard();

  const fetchInstructions = useCallback(async (gameFormat: string, formation: string) => {
    const fetchId = instructionsGuard.begin();
    try {
      const { data, error } = await supabase
        .from('position_instructions')
        .select('*')
        .eq('game_format', gameFormat)
        .eq('formation', formation)
        .order('position_index');

      if (!instructionsGuard.isCurrent(fetchId)) return;
      if (error) throw error;
      setPositionInstructions(data || []);
    } catch {
      // state ongewijzigd laten bij fetch-fout
    }
  }, [instructionsGuard]);

  const fetchMatchInstructions = useCallback(async (matchId: number, formation: string) => {
    const fetchId = matchInstructionsGuard.begin();
    try {
      const { data, error } = await supabase
        .from('match_position_instructions')
        .select('*')
        .eq('match_id', matchId)
        .eq('formation', formation)
        .order('position_index');

      if (!matchInstructionsGuard.isCurrent(fetchId)) return;
      if (error) throw error;
      setMatchInstructions(data || []);
    } catch {
      // state ongewijzigd laten bij fetch-fout
    }
  }, [matchInstructionsGuard]);

  const clearMatchInstructions = useCallback(() => {
    setMatchInstructions([]);
  }, []);

  const getInstructionForPosition = useCallback((positionIndex: number): PositionInstruction | null => {
    // Wedstrijd-specifieke afwijking heeft prioriteit boven globale instructie
    const matchOverride = matchInstructions.find((i: PositionInstruction) => i.position_index === positionIndex);
    if (matchOverride) return matchOverride;
    return positionInstructions.find(i => i.position_index === positionIndex) || null;
  }, [positionInstructions, matchInstructions]);

  const saveInstruction = useCallback(async (
    instruction: PositionInstruction,
    gameFormat: string,
    formation: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('position_instructions')
        .upsert({
          game_format: instruction.game_format ?? gameFormat,
          formation: instruction.formation,
          position_index: instruction.position_index,
          position_name: instruction.position_name,
          title: instruction.title,
          general_tips: instruction.general_tips,
          with_ball: instruction.with_ball,
          without_ball: instruction.without_ball
        }, {
          onConflict: 'game_format,formation,position_index'
        });

      if (error) throw error;

      await fetchInstructions(gameFormat, formation);
      setEditingInstruction(null);
      return true;
    } catch {
      return false;
    }
  }, [fetchInstructions]);

  const saveMatchInstruction = useCallback(async (
    instruction: PositionInstruction,
    matchId: number,
    formation: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('match_position_instructions')
        .upsert({
          match_id: matchId,
          formation: formation,
          position_index: instruction.position_index,
          position_name: instruction.position_name,
          title: instruction.title,
          general_tips: instruction.general_tips,
          with_ball: instruction.with_ball,
          without_ball: instruction.without_ball
        }, {
          onConflict: 'match_id,position_index'
        });

      if (error) throw error;

      await fetchMatchInstructions(matchId, formation);
      setEditingInstruction(null);
      return true;
    } catch {
      return false;
    }
  }, [fetchMatchInstructions]);

  const deleteMatchInstruction = useCallback(async (
    matchId: number,
    positionIndex: number,
    formation: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('match_position_instructions')
        .delete()
        .eq('match_id', matchId)
        .eq('position_index', positionIndex);

      if (error) throw error;

      await fetchMatchInstructions(matchId, formation);
      return true;
    } catch {
      return false;
    }
  }, [fetchMatchInstructions]);

  return {
    positionInstructions,
    matchInstructions,
    editingInstruction,
    setEditingInstruction,
    fetchInstructions,
    fetchMatchInstructions,
    clearMatchInstructions,
    getInstructionForPosition,
    saveInstruction,
    saveMatchInstruction,
    deleteMatchInstruction
  };
}
