import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { PositionInstruction } from '../lib/types';

export function useInstructions() {
  const [positionInstructions, setPositionInstructions] = useState<PositionInstruction[]>([]);
  const [matchInstructions, setMatchInstructions] = useState<PositionInstruction[]>([]);
  const [editingInstruction, setEditingInstruction] = useState<PositionInstruction | null>(null);

  const fetchInstructions = useCallback(async (formation: string) => {
    try {
      const { data, error } = await supabase
        .from('position_instructions')
        .select('*')
        .eq('formation', formation)
        .order('position_index');

      if (error) throw error;
      setPositionInstructions(data || []);
    } catch (error) {
      console.error('Error fetching instructions:', error);
    }
  }, []);

  const fetchMatchInstructions = useCallback(async (matchId: number, formation: string) => {
    try {
      const { data, error } = await supabase
        .from('match_position_instructions')
        .select('*')
        .eq('match_id', matchId)
        .eq('formation', formation)
        .order('position_index');

      if (error) throw error;
      setMatchInstructions(data || []);
    } catch (error) {
      console.error('Error fetching match instructions:', error);
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
    formation: string
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('position_instructions')
        .upsert({
          formation: instruction.formation,
          position_index: instruction.position_index,
          position_name: instruction.position_name,
          title: instruction.title,
          general_tips: instruction.general_tips,
          with_ball: instruction.with_ball,
          without_ball: instruction.without_ball
        }, {
          onConflict: 'formation,position_index'
        });

      if (error) throw error;

      await fetchInstructions(formation);
      setEditingInstruction(null);
      return true;
    } catch (error) {
      console.error('Error saving instruction:', error);
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
    } catch (error) {
      console.error('Error saving match instruction:', error);
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
    } catch (error) {
      console.error('Error deleting match instruction:', error);
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
