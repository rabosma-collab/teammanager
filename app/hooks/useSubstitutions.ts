import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Player, Substitution, TempSubstitution } from '../lib/types';

export function useSubstitutions() {
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [tempSubs, setTempSubs] = useState<TempSubstitution[]>([]);
  const [showSubModal, setShowSubModal] = useState<number | null>(null);

  const fetchSubstitutions = useCallback(async (matchId: number) => {
    try {
      const { data, error } = await supabase
        .from('substitutions')
        .select('*')
        .eq('match_id', matchId);

      if (error) throw error;
      setSubstitutions(data || []);
    } catch (error) {
      console.error('Error fetching substitutions:', error);
    }
  }, []);

  const getSubsForNumber = useCallback((subNumber: number): Substitution[] => {
    return substitutions.filter(s => s.substitution_number === subNumber);
  }, [substitutions]);

  const openSubModal = useCallback((
    subNumber: number,
    players: Player[]
  ) => {
    const existing = substitutions.filter(s => s.substitution_number === subNumber);
    setTempSubs(existing.map(s => ({
      out: players.find(p => p.id === s.player_out_id) || null,
      in: players.find(p => p.id === s.player_in_id) || null
    })));
    setShowSubModal(subNumber);
  }, [substitutions]);

  const addTempSub = useCallback(() => {
    setTempSubs(prev => [...prev, { out: null, in: null }]);
  }, []);

  const removeTempSub = useCallback((index: number) => {
    setTempSubs(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateTempSub = useCallback((
    index: number,
    field: 'out' | 'in',
    player: Player | null
  ) => {
    setTempSubs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: player };
      return updated;
    });
  }, []);

  const saveSubstitutions = useCallback(async (matchId: number): Promise<boolean> => {
    if (!showSubModal) return false;

    const allComplete = tempSubs.every(s => s.out && s.in);
    if (!allComplete) {
      alert('⚠️ Vul alle wissels compleet in');
      return false;
    }

    const outIds = tempSubs.map(s => s.out!.id);
    const inIds = tempSubs.map(s => s.in!.id);
    if (new Set(outIds).size !== outIds.length) {
      alert('⚠️ Een speler kan maar 1x gewisseld worden');
      return false;
    }
    if (new Set(inIds).size !== inIds.length) {
      alert('⚠️ Een speler kan maar 1x ingebracht worden');
      return false;
    }

    try {
      await supabase
        .from('substitutions')
        .delete()
        .eq('match_id', matchId)
        .eq('substitution_number', showSubModal);

      const minute = showSubModal === 1 ? 30 : 60;
      const subsToInsert = tempSubs.map(s => ({
        match_id: matchId,
        substitution_number: showSubModal,
        minute,
        player_out_id: s.out!.id,
        player_in_id: s.in!.id
      }));

      const { error } = await supabase
        .from('substitutions')
        .insert(subsToInsert);

      if (error) throw error;

      await fetchSubstitutions(matchId);
      setShowSubModal(null);
      setTempSubs([]);
      return true;
    } catch (error) {
      console.error('Error saving substitutions:', error);
      return false;
    }
  }, [showSubModal, tempSubs, fetchSubstitutions]);

  const closeSubModal = useCallback(() => {
    setShowSubModal(null);
    setTempSubs([]);
  }, []);

  return {
    substitutions,
    tempSubs,
    showSubModal,
    fetchSubstitutions,
    getSubsForNumber,
    openSubModal,
    addTempSub,
    removeTempSub,
    updateTempSub,
    saveSubstitutions,
    closeSubModal
  };
}