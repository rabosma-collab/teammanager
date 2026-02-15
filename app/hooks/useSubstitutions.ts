import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Player, Substitution, TempSubstitution } from '../lib/types';
import { useTeamContext } from '../contexts/TeamContext';

export function useSubstitutions() {
  const { currentTeam } = useTeamContext();
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [tempSubs, setTempSubs] = useState<TempSubstitution[]>([]);
  const [showSubModal, setShowSubModal] = useState<number | null>(null);
  const [showSubModalMinute, setShowSubModalMinute] = useState<number | null>(null);
  const [customMinuteInput, setCustomMinuteInput] = useState<number>(45);

  const fetchSubstitutions = useCallback(async (matchId: number) => {
    if (!currentTeam) return;

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
  }, [currentTeam]);

  const getSubsForNumber = useCallback((subNumber: number): Substitution[] => {
    return substitutions.filter(s => s.substitution_number === subNumber && !s.is_extra);
  }, [substitutions]);

  const openSubModal = useCallback((
    subNumber: number,
    players: Player[],
    minute?: number
  ) => {
    const existing = substitutions.filter(s => s.substitution_number === subNumber);
    setTempSubs(existing.map(s => ({
      out: players.find(p => p.id === s.player_out_id) || null,
      in: players.find(p => p.id === s.player_in_id) || null
    })));
    setShowSubModal(subNumber);
    setShowSubModalMinute(minute ?? null);
    if (existing.length > 0 && existing[0].custom_minute) {
      setCustomMinuteInput(existing[0].custom_minute);
    }
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

  const saveSubstitutions = useCallback(async (
    matchId: number,
    minuteOverride?: number
  ): Promise<boolean> => {
    if (!currentTeam || !showSubModal) return false;

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

      const minute = minuteOverride ?? showSubModalMinute ?? 0;
      const isCustom = minuteOverride !== undefined;

      const subsToInsert = tempSubs.map(s => ({
        match_id: matchId,
        substitution_number: showSubModal,
        minute: minute,
        player_out_id: s.out!.id,
        player_in_id: s.in!.id,
        custom_minute: isCustom ? minute : null,
        is_extra: false
      }));

      const { error } = await supabase
        .from('substitutions')
        .insert(subsToInsert);

      if (error) throw error;

      await fetchSubstitutions(matchId);
      setShowSubModal(null);
      setShowSubModalMinute(null);
      setTempSubs([]);
      return true;
    } catch (error) {
      console.error('Error saving substitutions:', error);
      return false;
    }
  }, [showSubModal, showSubModalMinute, tempSubs, fetchSubstitutions, currentTeam]);

  const closeSubModal = useCallback(() => {
    setShowSubModal(null);
    setShowSubModalMinute(null);
    setTempSubs([]);
  }, []);

  return {
    substitutions,
    tempSubs,
    showSubModal,
    showSubModalMinute,
    customMinuteInput,
    setCustomMinuteInput,
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
