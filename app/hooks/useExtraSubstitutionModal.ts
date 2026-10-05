import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Match, Player } from '../lib/types';
import { useToast } from '../contexts/ToastContext';
import { useConfirm } from '../contexts/ConfirmContext';

interface UseExtraSubstitutionModalParams {
  selectedMatch: Match | null;
  matchDuration: number;
  fetchSubstitutions: (matchId: number) => Promise<void>;
}

// Beheert het "extra wissel"-venster: state + toevoegen/verwijderen via Supabase.
export function useExtraSubstitutionModal({
  selectedMatch,
  matchDuration,
  fetchSubstitutions,
}: UseExtraSubstitutionModalParams) {
  const toast = useToast();
  const confirm = useConfirm();
  const [showExtraSubModal, setShowExtraSubModal] = useState(false);
  const [extraSubMinute, setExtraSubMinute] = useState(45);
  const [extraSubOut, setExtraSubOut] = useState<Player | null>(null);
  const [extraSubIn, setExtraSubIn] = useState<Player | null>(null);

  const addExtraSubstitution = useCallback(async (minute: number, playerOutId: number, playerInId: number) => {
    if (!selectedMatch) return;
    try {
      const { error } = await supabase
        .from('substitutions')
        .insert({
          match_id: selectedMatch.id,
          substitution_number: 0,
          minute: 0,
          custom_minute: minute,
          player_out_id: playerOutId,
          player_in_id: playerInId,
          is_extra: true
        });

      if (error) throw error;

      await fetchSubstitutions(selectedMatch.id);
      setShowExtraSubModal(false);
      setExtraSubMinute(Math.floor(matchDuration / 2));
      setExtraSubOut(null);
      setExtraSubIn(null);
      toast.success('✅ Extra wissel toegevoegd!');
    } catch (error) {
      console.error('Error adding extra sub:', error);
      toast.error('❌ Kon wissel niet toevoegen');
    }
  }, [selectedMatch, fetchSubstitutions]);

  const deleteExtraSubstitution = useCallback(async (subId: number) => {
    if (!(await confirm('Weet je zeker dat je deze extra wissel wilt verwijderen?', { danger: true, confirmLabel: 'Verwijderen' }))) return;
    try {
      const { error } = await supabase
        .from('substitutions')
        .delete()
        .eq('id', subId);

      if (error) throw error;

      if (selectedMatch) {
        await fetchSubstitutions(selectedMatch.id);
      }
      toast.success('✅ Extra wissel verwijderd');
    } catch (error) {
      console.error('Error deleting extra sub:', error);
      toast.error('❌ Kon wissel niet verwijderen');
    }
  }, [selectedMatch, fetchSubstitutions, confirm]);

  return {
    showExtraSubModal,
    setShowExtraSubModal,
    extraSubMinute,
    setExtraSubMinute,
    extraSubOut,
    setExtraSubOut,
    extraSubIn,
    setExtraSubIn,
    addExtraSubstitution,
    deleteExtraSubstitution,
  };
}
