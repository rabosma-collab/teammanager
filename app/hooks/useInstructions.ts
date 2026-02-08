import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { PositionInstruction } from '../lib/types';

export function useInstructions() {
  const [positionInstructions, setPositionInstructions] = useState<PositionInstruction[]>([]);
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

  const getInstructionForPosition = useCallback((positionIndex: number): PositionInstruction | null => {
    return positionInstructions.find(i => i.position_index === positionIndex) || null;
  }, [positionInstructions]);

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

  return {
    positionInstructions,
    editingInstruction,
    setEditingInstruction,
    fetchInstructions,
    getInstructionForPosition,
    saveInstruction
  };
}