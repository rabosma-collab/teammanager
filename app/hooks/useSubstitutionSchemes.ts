import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { SubstitutionScheme } from '../lib/types';

export function useSubstitutionSchemes() {
  const [schemes, setSchemes] = useState<SubstitutionScheme[]>([]);

  const fetchSchemes = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('substitution_schemes')
        .select('*')
        .order('id', { ascending: true });

      if (error) throw error;
      setSchemes(data || []);
    } catch (error) {
      console.error('Error fetching substitution schemes:', error);
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
