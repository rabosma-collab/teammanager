import { useState } from 'react';
import type { Match, Player } from '../lib/types';
import { useToast } from '../contexts/ToastContext';

interface UseGuestPlayerModalParams {
  selectedMatch: Match | null;
  addGuestPlayer: (name: string, position: string, matchId: number) => Promise<boolean>;
  fetchPlayers: (matchId?: number) => Promise<Player[]>;
  fetchGuestSelections: (matchId: number) => Promise<void>;
}

// Beheert het gastspeler-venster: zichtbaarheid + toevoegen van een gastspeler aan de wedstrijd.
export function useGuestPlayerModal({
  selectedMatch,
  addGuestPlayer,
  fetchPlayers,
  fetchGuestSelections,
}: UseGuestPlayerModalParams) {
  const toast = useToast();
  const [showGuestModal, setShowGuestModal] = useState(false);

  const handleAddGuest = async (name: string, position: string) => {
    if (!selectedMatch) return;
    const success = await addGuestPlayer(name, position, selectedMatch.id);
    if (success) {
      setShowGuestModal(false);
      await Promise.all([
        fetchPlayers(selectedMatch.id),
        fetchGuestSelections(selectedMatch.id),
      ]);
      toast.success(`✅ Gastspeler ${name} toegevoegd!`);
    } else {
      toast.error('❌ Kon gastspeler niet toevoegen');
    }
  };

  return { showGuestModal, setShowGuestModal, handleAddGuest };
}
