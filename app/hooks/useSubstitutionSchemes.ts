import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SubstitutionScheme } from '../lib/types';

export function useSubstitutionSchemes() {
  const [schemes, setSchemes] = useState<SubstitutionScheme[]>([]);

  const fetchSchemes = useCallback(async (teamId?: string) => {
    try {
      let query = supabase
        .from('substitution_schemes')
        .select('*')
        .order('id', { ascending: true });

      if (teamId) {
        query = query.or(`team_id.is.null,team_id.eq.${teamId}`);
      } else {
        query = query.is('team_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSchemes(data || []);
    } catch {
      // state ongewijzigd laten bij fetch-fout
    }
  }, []);

  const getSchemeById = useCallback((schemeId: number): SubstitutionScheme | null => {
    return schemes.find(s => s.id === schemeId) || null;
  }, [schemes]);

  return {
    schemes,
    fetchSchemes,
    getSchemeById
  };
}
