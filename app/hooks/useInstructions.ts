import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { PositionInstruction } from '../lib/types';

export function useInstructions() {
  const [positionInstructions, setPositionInstructions] = useState<PositionInstruction[]>([]);
  const [matchInstructions, setMatchInstructions] = useState<PositionInstruction[]>([]);
  const [editingInstruction, setEditingInstruction] = useState<PositionInstruction | null>(null);
  const fetchInstructionsIdRef = useRef(0);
  const fetchMatchInstructionsIdRef = useRef(0);

  const fetchInstructions = useCallback(async (gameFormat: string, formation: string) => {
    const fetchId = ++fetchInstructionsIdRef.current;
    try {
      const { data, error } = await supabase
        .from('position_instructions')
        .select('*')
        .eq('game_format', gameFormat)
        .eq('formation', formation)
        .order('position_index');

      if (fetchId !== fetchInstructionsIdRef.current) return;
      if (error) throw error;
      setPositionInstructions(data || []);
    } catch {
      // state ongewijzigd laten bij fetch-fout
    }
  }, []);

  const fetchMatchInstructions = useCallback(async (matchId: number, formation: string) => {
    const fetchId = ++fetchMatchInstructionsIdRef.current;
    try {
      const { data, error } = await supabase
        .from('match_position_instructions')
        .select('*')
        .eq('match_id', matchId)
        .eq('formation', formation)
        .order('position_index');

      if (fetchId !== fetchMatchInstructionsIdRef.current) return;
      if (error) throw error;
      setMatchInstructions(data || []);
    } catch {
      // state ongewijzigd laten bij fetch-fout
    }
  }, []);

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
