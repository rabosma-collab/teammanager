"use client";

import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';

interface Player {
  id: number;
  name: string;
  position: string;
  goals: number;
  assists: number;
  was: number;
  min: number;
  injured: boolean;
}

interface Match {
  id: number;
  date: string;
  opponent: string;
  home_away: string;
  formation: string;
}

interface Substitution {
  id: number;
  match_id: number;
  substitution_number: number;
  minute: number;
  player_out_id: number;
  player_in_id: number;
}

export default function FootballApp() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [matchAbsences, setMatchAbsences] = useState<number[]>([]);
  const [substitutions, setSubstitutions] = useState<Substitution[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('pitch');
  const [formation, setFormation] = useState('4-3-3-aanvallend');
  const [isAdmin, setIsAdmin] = useState(false);
  const [fieldOccupants, setFieldOccupants] = useState<(Player | null)[]>(Array(11).fill(null));
  const [benchPlayers, setBenchPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [savingLineup, setSavingLineup] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState<number | null>(null);
  const [tempSubs, setTempSubs] = useState<Array<{out: Player | null, in: Player | null}>>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const formations: Record<string, Array<{t: number, l: number}>> = {
    '4-3-3-aanvallend': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 52, l: 30 }, { t: 52, l: 70 },
      { t: 35, l: 50 },
      { t: 20, l: 15 }, { t: 15, l: 50 }, { t: 20, l: 85 }
    ],
    '4-3-3-verdedigend': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 58, l: 50 },
      { t: 45, l: 30 }, { t: 45, l: 70 },
      { t: 20, l: 15 }, { t: 15, l: 50 }, { t: 20, l: 85 }
    ],
    '4-4-2-plat': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 48, l: 15 }, { t: 48, l: 38 }, { t: 48, l: 62 }, { t: 48, l: 85 },
      { t: 22, l: 35 }, { t: 22, l: 65 }
    ],
    '4-4-2-ruit': [
      { t: 88, l: 50 },
      { t: 72, l: 15 }, { t: 75, l: 38 }, { t: 75, l: 62 }, { t: 72, l: 85 },
      { t: 58, l: 50 },
      { t: 45, l: 25 }, { t: 45, l: 75 },
      { t: 32, l: 50 },
      { t: 18, l: 35 }, { t: 18, l: 65 }
    ],
    '3-4-3': [
      { t: 88, l: 50 },
      { t: 72, l: 25 }, { t: 75, l: 50 }, { t: 72, l: 75 },
      { t: 48, l: 10 }, { t: 48, l: 37 }, { t: 48, l: 63 }, { t: 48, l: 90 },
      { t: 22, l: 20 }, { t: 18, l: 50 }, { t: 22, l: 80 }
    ],
    '5-3-2': [
      { t: 88, l: 50 },
      { t: 72, l: 10 }, { t: 75, l: 30 }, { t: 78, l: 50 }, { t: 75, l: 70 }, { t: 72, l: 90 },
      { t: 50, l: 25 }, { t: 50, l: 50 }, { t: 50, l: 75 },
      { t: 22, l: 35 }, { t: 22, l: 65 }
    ]
  };

  const formationLabels: Record<string, string> = {
    '4-3-3-aanvallend': '4-3-3 Aanvallend',
    '4-3-3-verdedigend': '4-3-3 Verdedigend',
    '4-4-2-plat': '4-4-2 Plat',
    '4-4-2-ruit': '4-4-2 Ruit',
    '3-4-3': '3-4-3',
    '5-3-2': '5-3-2'
  };

  const positionOrder = ['Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller'];
  const positionEmojis: Record<string, string> = {
    'Keeper': '🧤',
    'Verdediger': '🛡️',
    'Middenvelder': '⚙️',
    'Aanvaller': '⚡'
  };

  const normalizeFormation = (form: string | null | undefined): string => {
    if (!form || !(form in formations)) return '4-3-3-aanvallend';
    return form;
  };

  const getGroupedPlayers = (): Record<string, Player[]> => {
    const grouped: Record<string, Player[]> = {};
    positionOrder.forEach(pos => {
      grouped[pos] = players
        .filter(p => p.position === pos)
        .sort((a, b) => b.min - a.min);
    });
    return grouped;
  };

  const getSubstitutionsForNumber = (subNumber: number): Substitution[] => {
    return substitutions.filter(s => s.substitution_number === subNumber);
  };

  const isPlayerOnField = (playerId: number): boolean => {
    return fieldOccupants.some(p => p && p.id === playerId);
  };

  const updateBench = () => {
    const fieldPlayerIds = fieldOccupants.filter(p => p !== null).map(p => p!.id);
    const bench = players.filter(p => 
      !fieldPlayerIds.includes(p.id) && 
      !p.injured && 
      !matchAbsences.includes(p.id)
    );
    setBenchPlayers(bench);
  };

  useEffect(() => {
    fetchPlayers();
    fetchMatches();
  }, []);

  useEffect(() => {
    if (selectedMatch) {
      setFormation(normalizeFormation(selectedMatch.formation));
      fetchMatchAbsences(selectedMatch.id);
      fetchSubstitutions(selectedMatch.id);
      if (players.length > 0) {
        loadLineup(selectedMatch.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatch?.id]);

  useEffect(() => {
    if (selectedMatch && players.length > 0) {
      loadLineup(selectedMatch.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players.length]);

  useEffect(() => {
    updateBench();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldOccupants, players, matchAbsences]);

  const fetchPlayers = async () => {
    try {
      const { data, error } = await supabase
        .from('players')
        .select('*');
      
      if (error) throw error;
      setPlayers(data || []);
    } catch (error) {
      console.error('Error fetching players:', error);
    }
  };

  const fetchMatches = async () => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      setMatches(data || []);
      
      if (data && data.length > 0) {
        const upcoming = data.find(m => new Date(m.date) >= new Date());
        setSelectedMatch(upcoming || data[0]);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchAbsences = async (matchId: number) => {
    try {
      const { data, error } = await supabase
        .from('match_absences')
        .select('player_id')
        .eq('match_id', matchId);
      
      if (error) throw error;
      setMatchAbsences(data?.map(a => a.player_id) || []);
    } catch (error) {
      console.error('Error fetching absences:', error);
    }
  };

  const fetchSubstitutions = async (matchId: number) => {
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
  };

  const openSubModal = (subNumber: number) => {
    const existing = getSubstitutionsForNumber(subNumber);
    setTempSubs(existing.map(s => ({
      out: players.find(p => p.id === s.player_out_id) || null,
      in: players.find(p => p.id === s.player_in_id) || null
    })));
    setShowSubModal(subNumber);
  };

  const addTempSub = () => {
    setTempSubs([...tempSubs, { out: null, in: null }]);
  };

  const removeTempSub = (index: number) => {
    setTempSubs(tempSubs.filter((_, i) => i !== index));
  };

  const updateTempSub = (index: number, field: 'out' | 'in', player: Player | null) => {
    const updated = [...tempSubs];
    updated[index] = { ...updated[index], [field]: player };
    setTempSubs(updated);
  };

  const saveAllSubstitutions = async () => {
    if (!showSubModal || !selectedMatch) return;
    
    const allComplete = tempSubs.every(s => s.out && s.in);
    if (!allComplete) {
      alert('⚠️ Vul alle wissels compleet in');
      return;
    }

    const outPlayers = tempSubs.map(s => s.out!.id);
    const inPlayers = tempSubs.map(s => s.in!.id);
    if (new Set(outPlayers).size !== outPlayers.length) {
      alert('⚠️ Een speler kan maar 1x gewisseld worden');
      return;
    }
    if (new Set(inPlayers).size !== inPlayers.length) {
      alert('⚠️ Een speler kan maar 1x ingebracht worden');
      return;
    }

    try {
      await supabase
        .from('substitutions')
        .delete()
        .eq('match_id', selectedMatch.id)
        .eq('substitution_number', showSubModal);

      const minute = showSubModal === 1 ? 30 : 60;
      const subsToInsert = tempSubs.map(s => ({
        match_id: selectedMatch.id,
        substitution_number: showSubModal,
        minute: minute,
        player_out_id: s.out!.id,
        player_in_id: s.in!.id
      }));

      const { error } = await supabase
        .from('substitutions')
        .insert(subsToInsert);

      if (error) throw error;

      await fetchSubstitutions(selectedMatch.id);
      setShowSubModal(null);
      setTempSubs([]);
      alert('✅ Wissels opgeslagen!');
    } catch (error) {
      console.error('Error saving substitutions:', error);
      alert('❌ Kon wissels niet opslaan');
    }
  };

  const togglePlayerInjury = async (playerId: number) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const newInjuredStatus = !player.injured;
    
    try {
      const { error } = await supabase
        .from('players')
        .update({ injured: newInjuredStatus })
        .eq('id', playerId);
      
      if (error) throw error;
      
      setPlayers(players.map(p => 
        p.id === playerId ? { ...p, injured: newInjuredStatus } : p
      ));
      
      alert(newInjuredStatus ? '🏥 Speler geblesseerd' : '✅ Speler hersteld');
    } catch (error) {
      console.error('Error updating injury:', error);
    }
  };

  const toggleMatchAbsence = async (playerId: number) => {
    if (!selectedMatch) return;
    
    const isAbsent = matchAbsences.includes(playerId);
    
    try {
      if (isAbsent) {
        const { error } = await supabase
          .from('match_absences')
          .delete()
          .eq('match_id', selectedMatch.id)
          .eq('player_id', playerId);
        
        if (error) throw error;
        setMatchAbsences(matchAbsences.filter(id => id !== playerId));
      } else {
        const { error } = await supabase
          .from('match_absences')
          .insert({
            match_id: selectedMatch.id,
            player_id: playerId,
            reason: 'Afwezig'
          });
        
        if (error) throw error;
        setMatchAbsences([...matchAbsences, playerId]);
      }
    } catch (error) {
      console.error('Error toggling absence:', error);
    }
  };

  const isPlayerAvailable = (player: Player | null): boolean => {
    if (!player) return false;
    return !player.injured && !matchAbsences.includes(player.id);
  };

  const loadLineup = async (matchId: number) => {
    if (players.length === 0) return;
    
    try {
      const { data: lineupData, error: lineupError } = await supabase
        .from('lineups')
        .select('position, player_id')
        .eq('match_id', matchId);
      
      if (lineupError) throw lineupError;
      
      const lineup: (Player | null)[] = Array(11).fill(null);
      
      if (lineupData && lineupData.length > 0) {
        lineupData.forEach(entry => {
          if (entry.position >= 0 && entry.position < 11 && entry.player_id) {
            const player = players.find(p => p.id === entry.player_id);
            if (player) {
              lineup[entry.position] = player;
            }
          }
        });
      }
      
      setFieldOccupants(lineup);
    } catch (error) {
      console.error('Error loading lineup:', error);
      setFieldOccupants(Array(11).fill(null));
    }
  };

  const saveLineup = async () => {
    if (!selectedMatch || !isAdmin) return;
    
    setSavingLineup(true);
    try {
      await supabase
        .from('lineups')
        .delete()
        .eq('match_id', selectedMatch.id);
      
      const lineupData = fieldOccupants
        .map((player, position) => ({
          match_id: selectedMatch.id,
          position,
          player_id: player?.id || null
        }))
        .filter(item => item.player_id !== null);
      
      if (lineupData.length > 0) {
        const { error: insertError } = await supabase
          .from('lineups')
          .insert(lineupData);
        
        if (insertError) throw insertError;
      }
      
      await supabase
        .from('matches')
        .update({ formation })
        .eq('id', selectedMatch.id);
      
      alert('✅ Opstelling opgeslagen!');
      await loadLineup(selectedMatch.id);
    } catch (error) {
      console.error('Error saving lineup:', error);
      alert('❌ Kon opstelling niet opslaan');
    } finally {
      setSavingLineup(false);
    }
  };

  const updatePlayerStat = async (id: number, field: string, value: string) => {
    try {
      const { error } = await supabase
        .from('players')
        .update({ [field]: parseInt(value) || 0 })
        .eq('id', id);
      
      if (error) throw error;
      
      setPlayers(players.map(p => 
        p.id === id ? { ...p, [field]: parseInt(value) || 0 } : p
      ));
    } catch (error) {
      console.error('Error updating player:', error);
    }
  };

  const login = () => {
    const password = prompt("Admin wachtwoord:");
    if (password === "swenenrobin") {
      setIsAdmin(true);
      alert("✅ Admin ingelogd!");
    } else if (password) {
      alert("❌ Verkeerd wachtwoord");
    }
  };

  const isMatchEditable = (): boolean => {
    if (!selectedMatch || !isAdmin) return false;
    const matchDate = new Date(selectedMatch.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return matchDate >= today;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">⚽</div>
          <div>Laden...</div>
        </div>
      </div>
    );
  }

  const groupedPlayers = getGroupedPlayers();
  const sub1 = getSubstitutionsForNumber(1);
  const sub2 = getSubstitutionsForNumber(2);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      
      <nav className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 bg-gray-800 border-b border-gray-700">
        {view === 'pitch' && (
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-700 rounded"
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
        
        <button 
          onClick={() => setView('pitch')}
          className={`px-3 sm:px-6 py-2 rounded font-bold transition text-sm sm:text-base ${
            view === 'pitch' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <span className="hidden sm:inline">⚽ Tactiekveld</span>
          <span className="sm:hidden">⚽</span>
        </button>
        <button 
          onClick={() => setView('stats')}
          className={`px-3 sm:px-6 py-2 rounded font-bold transition text-sm sm:text-base ${
            view === 'stats' ? 'bg-yellow-500 text-black' : 'bg-gray-700 hover:bg-gray-600'
          }`}
        >
          <span className="hidden sm:inline">📊 Ranglijst</span>
          <span className="sm:hidden">📊</span>
        </button>
        
        {!isAdmin ? (
          <button 
            onClick={login}
            className="ml-auto px-3 sm:px-6 py-2 bg-yellow-500 text-black rounded font-bold hover:bg-yellow-400 text-sm sm:text-base"
          >
            <span className="hidden sm:inline">🔒 Admin</span>
            <span className="sm:hidden">🔒</span>
          </button>
        ) : (
          <button 
            onClick={() => setIsAdmin(false)}
            className="ml-auto px-3 sm:px-6 py-2 bg-red-500 rounded font-bold hover:bg-red-600 text-sm sm:text-base"
          >
            <span className="hidden sm:inline">🔓 Logout</span>
            <span className="sm:hidden">🔓</span>
          </button>
        )}
      </nav>

      {showSubModal && isAdmin && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-gray-800 rounded-xl p-4 sm:p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-2xl font-bold">
                🔄 Wissel {showSubModal} - {showSubModal === 1 ? 30 : 60} min
              </h2>
              <button 
                onClick={() => {
                  setShowSubModal(null);
                  setTempSubs([]);
                }}
                className="text-2xl hover:text-red-500 p-2"
              >
                ✕
              </button>
            </div>

            <p className="text-xs sm:text-sm text-gray-400 mb-4">
              {showSubModal === 1 
                ? 'Stel alle wissels in voor het eerste wisselmoment (30 minuten).' 
                : 'Stel alle wissels in voor het tweede wisselmoment (60 minuten).'}
            </p>

            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              {tempSubs.map((sub, index) => {
                let availableToGoOut: Player[] = [];
                let availableToGoIn: Player[] = [];
                
                if (showSubModal === 1) {
                  availableToGoOut = fieldOccupants.filter((p): p is Player => p !== null);
                  availableToGoIn = benchPlayers;
                } else {
                  const sub1Players = getSubstitutionsForNumber(1);
                  
                  const playersOutInSub1 = sub1Players.map(s => s.player_out_id);
                  const currentFieldPlayers = fieldOccupants.filter((p): p is Player => 
                    p !== null && !playersOutInSub1.includes(p.id)
                  );
                  
                  const playersInInSub1 = sub1Players
                    .map(s => players.find(p => p.id === s.player_in_id))
                    .filter((p): p is Player => p !== undefined);
                  
                  availableToGoOut = [...currentFieldPlayers, ...playersInInSub1];
                  
                  const playersWhoWentOutInSub1 = sub1Players
                    .map(s => players.find(p => p.id === s.player_out_id))
                    .filter((p): p is Player => p !== undefined);
                  
                  availableToGoIn = [...benchPlayers, ...playersWhoWentOutInSub1];
                }
                
                availableToGoOut = Array.from(new Map(availableToGoOut.map(p => [p.id, p])).values());
                availableToGoIn = Array.from(new Map(availableToGoIn.map(p => [p.id, p])).values());
                
                return (
                  <div key={index} className="bg-gray-700/50 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 sm:gap-4 mb-2">
                      <span className="font-bold text-gray-400 text-sm sm:text-base">Wissel {index + 1}</span>
                      <button
                        onClick={() => removeTempSub(index)}
                        className="ml-auto text-red-500 hover:text-red-400 text-sm p-2"
                      >
                        ✕ Verwijder
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-red-400 mb-2">⬇️ Eruit</label>
                        <select
                          value={sub.out?.id || ''}
                          onChange={(e) => {
                            const player = availableToGoOut.find(p => p.id === parseInt(e.target.value)) || null;
                            updateTempSub(index, 'out', player);
                          }}
                          className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm sm:text-base"
                        >
                          <option value="">Selecteer...</option>
                          {availableToGoOut.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-green-400 mb-2">⬆️ Erin</label>
                        <select
                          value={sub.in?.id || ''}
                          onChange={(e) => {
                            const player = availableToGoIn.find(p => p.id === parseInt(e.target.value)) || null;
                            updateTempSub(index, 'in', player);
                          }}
                          className="w-full px-2 sm:px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white text-sm sm:text-base"
                        >
                          <option value="">Selecteer...</option>
                          {availableToGoIn.map(player => (
                            <option key={player.id} value={player.id}>
                              {player.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={addTempSub}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold mb-4 text-sm sm:text-base"
            >
              + Voeg wissel toe
            </button>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={saveAllSubstitutions}
                disabled={tempSubs.length === 0}
                className="flex-1 px-4 sm:px-6 py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold text-sm sm:text-base"
              >
                ✅ Opslaan ({tempSubs.length})
              </button>
              <button
                onClick={() => {
                  setShowSubModal(null);
                  setTempSubs([]);
                }}
                className="px-4 sm:px-6 py-3 bg-gray-600 hover:bg-gray-700 rounded font-bold text-sm sm:text-base"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'pitch' ? (
        <div className="flex flex-1 overflow-hidden relative">
          
          <div className={`
            fixed lg:relative inset-y-0 left-0 z-40
            w-80 lg:w-80 
            bg-gray-800 border-r border-gray-700
            transform transition-transform duration-300 ease-in-out
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            overflow-y-auto
            pt-16 lg:pt-0
          `}>
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-yellow-500 font-bold text-xl">Selectie ({players.length})</h3>
                {isAdmin && isMatchEditable() && (
                  <button
                    onClick={() => setShowAbsenceModal(!showAbsenceModal)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                  >
                    {showAbsenceModal ? '✓' : '👥'}
                  </button>
                )}
              </div>
              
              {!isMatchEditable() && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded text-sm">
                  🔒 {isAdmin ? 'Wedstrijd in verleden' : 'Login als admin'}
                </div>
              )}

              {showAbsenceModal && isAdmin && (
                <div className="mb-4 p-3 bg-blue-900/30 border border-blue-700 rounded">
                  <h4 className="font-bold mb-2">Afwezigheid beheren</h4>
                  <p className="text-xs mb-2 opacity-70">Klik op speler om afwezigheid te markeren</p>
                </div>
              )}
              
              {positionOrder.map(position => (
                <div key={position} className="mb-6">
                  <h4 className="font-bold text-sm text-gray-400 mb-2 flex items-center gap-2">
                    <span>{positionEmojis[position]}</span>
                    <span>{position}</span>
                    <span className="text-xs opacity-70">({groupedPlayers[position]?.length || 0})</span>
                  </h4>
                  
                  {groupedPlayers[position]?.map(player => {
                    const isInjured = player.injured;
                    const isAbsent = matchAbsences.includes(player.id);
                    const isAvailable = isPlayerAvailable(player);
                    const onField = isPlayerOnField(player.id);
                    
                    return (
                      <div
                        key={player.id}
                        onClick={() => {
                          if (showAbsenceModal && isAdmin) {
                            toggleMatchAbsence(player.id);
                          } else if (isMatchEditable() && isAvailable && !onField) {
                            setSelectedPlayer(player);
                            setSidebarOpen(false);
                          } else if (onField) {
                            alert('⚠️ Deze speler staat al op het veld');
                          }
                        }}
                        onContextMenu={(e) => {
                          if (isAdmin) {
                            e.preventDefault();
                            togglePlayerInjury(player.id);
                          }
                        }}
                        className={`p-3 mb-2 rounded-lg transition relative ${
                          (isMatchEditable() && isAvailable && !onField) || showAbsenceModal ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
                        } ${
                          selectedPlayer?.id === player.id 
                            ? 'bg-gray-700 border-2 border-yellow-500' 
                            : isAbsent
                            ? 'bg-red-900/30 border-2 border-red-700'
                            : onField
                            ? 'bg-green-900/30 border-2 border-green-700'
                            : 'bg-gray-700/50 hover:bg-gray-700 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="font-bold flex-1">{player.name}</div>
                          <div className="text-xs opacity-70">{player.min} min</div>
                          {onField && <span className="text-green-500" title="Op het veld">⚽</span>}
                          {isInjured && <span className="text-red-500" title="Geblesseerd">🏥</span>}
                          {isAbsent && <span className="text-orange-500" title="Afwezig">❌</span>}
                        </div>
                        <div className="text-xs flex gap-3 mt-1 opacity-70">
                          <span>⚽{player.goals}</span>
                          <span>🎯{player.assists}</span>
                          <span>✅{player.was}x</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              
              {isAdmin && (
                <div className="mt-4 p-3 bg-gray-700 rounded text-xs">
                  <strong>Admin tips:</strong><br/>
                  • Rechtermuisklik: Blessure aan/uit<br/>
                  • 👥 knop: Afwezigheid instellen<br/>
                  • ⚽ = Speler staat op veld
                </div>
              )}
            </div>
          </div>

          {sidebarOpen && (
            <div 
              className="fixed inset-0 bg-black/50 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}

          <div className="flex-1 flex flex-col p-2 sm:p-4 lg:p-8 overflow-y-auto">
            
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-4 mb-4 sm:mb-6">
              <select 
                value={selectedMatch?.id || ''} 
                onChange={(e) => {
                  const match = matches.find(m => m.id === parseInt(e.target.value));
                  setSelectedMatch(match || null);
                  setShowAbsenceModal(false);
                }}
                className="px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 text-white font-bold text-sm sm:text-base flex-1 sm:flex-initial"
              >
                {matches.map(match => {
                  const matchDate = new Date(match.date);
                  const isPast = matchDate < new Date();
                  return (
                    <option key={match.id} value={match.id}>
                      {matchDate.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - {match.opponent}
                      {isPast ? ' ✓' : ''}
                    </option>
                  );
                })}
              </select>

              <select 
                value={formation} 
                onChange={(e) => isMatchEditable() && setFormation(e.target.value)}
                disabled={!isMatchEditable()}
                className="px-3 sm:px-4 py-2 rounded bg-gray-700 border border-gray-600 disabled:opacity-50 text-white text-sm sm:text-base"
              >
                {Object.keys(formations).map(f => (
                  <option key={f} value={f}>{formationLabels[f]}</option>
                ))}
              </select>
              
              <div className="flex gap-2 sm:gap-4">
                {isMatchEditable() && (
                  <button 
                    onClick={saveLineup}
                    disabled={savingLineup}
                    className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded font-bold bg-green-600 hover:bg-green-700 disabled:opacity-50 text-sm sm:text-base"
                  >
                    {savingLineup ? '💾' : '💾 Opslaan'}
                  </button>
                )}
                
                <button 
                  onClick={() => {
                    const matchInfo = selectedMatch 
                      ? `${new Date(selectedMatch.date).toLocaleDateString('nl-NL')} - ${selectedMatch.opponent}`
                      : 'Wedstrijd';
                    window.open(`https://wa.me/?text=Opstelling voor ${matchInfo} staat klaar!`);
                  }}
                  className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded font-bold bg-green-600 hover:bg-green-700 text-sm sm:text-base"
                >
                  📱 Delen
                </button>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-center lg:items-start justify-center mb-4 lg:mb-6">
              
              <div className="relative w-full max-w-[350px] sm:max-w-[400px] lg:w-[450px] aspect-[3/4] bg-green-700 border-4 border-white rounded-2xl overflow-hidden flex-shrink-0"
                   style={{ 
                     backgroundImage: 'repeating-linear-gradient(0deg, #2d5f2e, #2d5f2e 40px, #246824 40px, #246824 80px)'
                   }}>
                
                {formations[formation].map((pos, i) => {
                  const player = fieldOccupants[i];
                  const showWarning = player && !isPlayerAvailable(player);
                  
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        if (!isMatchEditable()) return;
                        
                        if (selectedPlayer) {
                          if (isPlayerAvailable(selectedPlayer)) {
                            if (isPlayerOnField(selectedPlayer.id)) {
                              alert('⚠️ Deze speler staat al op het veld');
                              return;
                            }
                            
                            const newField = [...fieldOccupants];
                            newField[i] = selectedPlayer;
                            setFieldOccupants(newField);
                            setSelectedPlayer(null);
                          } else {
                            alert('Deze speler is niet beschikbaar');
                          }
                        } else if (fieldOccupants[i]) {
                          const newField = [...fieldOccupants];
                          newField[i] = null;
                          setFieldOccupants(newField);
                        }
                      }}
                      className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${
                        isMatchEditable() ? 'cursor-pointer' : 'cursor-not-allowed'
                      }`}
                      style={{ top: `${pos.t}%`, left: `${pos.l}%` }}
                    >
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 ${
                        showWarning ? 'border-red-500' : 'border-white'
                      } flex items-center justify-center font-bold text-xs sm:text-sm relative ${
                        fieldOccupants[i] ? 'bg-yellow-500 text-black' : 'bg-white/20 text-white'
                      }`}>
                        {fieldOccupants[i] ? fieldOccupants[i]!.name.substring(0,2).toUpperCase() : '+'}
                        {showWarning && (
                          <span className="absolute -top-1 -right-1 text-red-500 text-base sm:text-lg">⚠️</span>
                        )}
                      </div>
                      {fieldOccupants[i] && (
                        <div className="text-xs font-bold text-center mt-1 text-white hidden sm:block" style={{ textShadow: '1px 1px 2px black' }}>
                          {fieldOccupants[i]!.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="w-full max-w-[350px] sm:max-w-[400px] lg:w-[380px] flex-shrink-0">
                <div className="bg-gradient-to-b from-amber-900 to-amber-950 rounded-t-3xl p-3 sm:p-4 border-4 border-amber-800">
                  <h3 className="text-center font-bold text-lg sm:text-xl mb-3 text-amber-200">🪑 Wisselbank</h3>
                  
                  {benchPlayers.length === 0 ? (
                    <div className="text-center py-6 sm:py-8 text-gray-400 text-sm">
                      Geen wisselspelers
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      {benchPlayers.map(player => (
                        <div
                          key={player.id}
                          onClick={() => {
                            if (isMatchEditable()) {
                              setSelectedPlayer(player);
                            }
                          }}
                          className={`bg-amber-950/50 border-2 ${
                            selectedPlayer?.id === player.id 
                              ? 'border-yellow-400' 
                              : 'border-amber-700'
                          } rounded-lg p-2 sm:p-3 text-center cursor-pointer hover:bg-amber-900/50 transition active:scale-95`}
                        >
                          <div className="font-bold text-xs sm:text-sm">{player.name}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {player.goals}⚽ {player.assists}🎯
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                {(players.filter(p => p.injured).length > 0 || matchAbsences.length > 0) && (
                  <div className="bg-gray-800 rounded-b-xl p-3 sm:p-4 border-4 border-t-0 border-gray-700">
                    <h4 className="font-bold text-xs sm:text-sm mb-2 text-gray-400">❌ Niet beschikbaar</h4>
                    <div className="flex flex-wrap gap-1 sm:gap-2">
                      {players.filter(p => p.injured).map(player => (
                        <span key={player.id} className="px-2 py-1 bg-red-900/30 border border-red-700 rounded text-xs">
                          {player.name} 🏥
                        </span>
                      ))}
                      {players.filter(p => matchAbsences.includes(p.id)).map(player => (
                        <span key={player.id} className="px-2 py-1 bg-orange-900/30 border border-orange-700 rounded text-xs">
                          {player.name} ❌
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-3 sm:gap-4 justify-center w-full max-w-[900px] mx-auto">
              <div className="flex-1 bg-gradient-to-br from-blue-900 to-blue-950 rounded-xl p-3 sm:p-4 border-2 border-blue-700">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm sm:text-lg">🔄 Wissel 1 (30 min)</h4>
                  {isAdmin && isMatchEditable() && (
                    <button
                      onClick={() => openSubModal(1)}
                      className="px-2 sm:px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs sm:text-sm"
                    >
                      {sub1.length > 0 ? `✏️ (${sub1.length})` : '+ Instellen'}
                    </button>
                  )}
                </div>
                
                {sub1.length === 0 ? (
                  <div className="text-center py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                    Nog niet ingesteld
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sub1.map(sub => {
                      const playerOut = players.find(p => p.id === sub.player_out_id);
                      const playerIn = players.find(p => p.id === sub.player_in_id);
                      return (
                        <div key={sub.id} className="bg-blue-950/50 rounded p-2 text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-red-400">⬇️ {playerOut?.name}</span>
                            <span>→</span>
                            <span className="text-green-400">⬆️ {playerIn?.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex-1 bg-gradient-to-br from-purple-900 to-purple-950 rounded-xl p-3 sm:p-4 border-2 border-purple-700">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-sm sm:text-lg">🔄 Wissel 2 (60 min)</h4>
                  {isAdmin && isMatchEditable() && (
                    <button
                      onClick={() => openSubModal(2)}
                      className="px-2 sm:px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs sm:text-sm"
                    >
                      {sub2.length > 0 ? `✏️ (${sub2.length})` : '+ Instellen'}
                    </button>
                  )}
                </div>
                
                {sub2.length === 0 ? (
                  <div className="text-center py-3 sm:py-4 text-gray-400 text-xs sm:text-sm">
                    Nog niet ingesteld
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sub2.map(sub => {
                      const playerOut = players.find(p => p.id === sub.player_out_id);
                      const playerIn = players.find(p => p.id === sub.player_in_id);
                      return (
                        <div key={sub.id} className="bg-purple-950/50 rounded p-2 text-xs sm:text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-red-400">⬇️ {playerOut?.name}</span>
                            <span>→</span>
                            <span className="text-green-400">⬆️ {playerIn?.name}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {selectedPlayer && isMatchEditable() && (
              <div className="mt-4 sm:mt-6 text-yellow-500 text-center text-sm sm:text-base px-4">
                {isPlayerAvailable(selectedPlayer) && !isPlayerOnField(selectedPlayer.id) ? (
                  <>👆 Klik op het veld om <strong>{selectedPlayer.name}</strong> te plaatsen</>
                ) : isPlayerOnField(selectedPlayer.id) ? (
                  <>⚠️ <strong>{selectedPlayer.name}</strong> staat al op het veld</>
                ) : (
                  <>⚠️ <strong>{selectedPlayer.name}</strong> is niet beschikbaar</>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        
        <div className="p-4 sm:p-8 overflow-x-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4 sm:mb-6">📊 Ranglijst</h2>

          <div className="bg-gray-800 rounded-lg overflow-hidden min-w-[600px]">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr className="text-left">
                  <th className="p-2 sm:p-4 text-sm sm:text-base">Speler</th>
                  <th className="p-2 sm:p-4 text-sm sm:text-base">Positie</th>
                  <th className="p-2 sm:p-4 text-sm sm:text-base">Status</th>
                  <th className="p-2 sm:p-4 text-sm sm:text-base">Goals</th>
                  <th className="p-2 sm:p-4 text-sm sm:text-base">Assists</th>
                  <th className="p-2 sm:p-4 text-sm sm:text-base">Was</th>
                  <th className="p-2 sm:p-4 text-sm sm:text-base">Wissel</th>
                </tr>
              </thead>
              <tbody>
                {players.map(player => (
                  <tr key={player.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                    <td className="p-2 sm:p-4 font-bold text-sm sm:text-base">{player.name}</td>
                    <td className="p-2 sm:p-4">
                      <span className="text-xs">{positionEmojis[player.position]} {player.position}</span>
                    </td>
                    <td className="p-2 sm:p-4">
                      {player.injured && <span className="text-red-500" title="Geblesseerd">🏥</span>}
                      {!player.injured && <span className="text-green-500">✓</span>}
                    </td>
                    <td className="p-2 sm:p-4">
                      {isAdmin ? (
                        <input 
                          type="number" 
                          value={player.goals}
                          onChange={(e) => updatePlayerStat(player.id, 'goals', e.target.value)}
                          className="w-12 sm:w-16 px-1 sm:px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        />
                      ) : player.goals}
                    </td>
                    <td className="p-2 sm:p-4">
                      {isAdmin ? (
                        <input 
                          type="number" 
                          value={player.assists}
                          onChange={(e) => updatePlayerStat(player.id, 'assists', e.target.value)}
                          className="w-12 sm:w-16 px-1 sm:px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        />
                      ) : player.assists}
                    </td>
                    <td className="p-2 sm:p-4">
                      {isAdmin ? (
                        <input 
                          type="number" 
                          value={player.was}
                          onChange={(e) => updatePlayerStat(player.id, 'was', e.target.value)}
                          className="w-12 sm:w-16 px-1 sm:px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        />
                      ) : player.was}
                    </td>
                    <td className="p-2 sm:p-4">
                      {isAdmin ? (
                        <input 
                          type="number" 
                          value={player.min}
                          onChange={(e) => updatePlayerStat(player.id, 'min', e.target.value)}
                          className="w-12 sm:w-16 px-1 sm:px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm"
                        />
                      ) : player.min}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}