export const formations: Record<string, Array<{ t: number; l: number }>> = {
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
      { t: 93, l: 50 },
      { t: 72, l: 10 }, { t: 75, l: 30 }, { t: 78, l: 50 }, { t: 75, l: 70 }, { t: 72, l: 90 },
      { t: 50, l: 25 }, { t: 50, l: 50 }, { t: 50, l: 75 },
      { t: 22, l: 35 }, { t: 22, l: 65 }
    ]
  };
  
  export const formationLabels: Record<string, string> = {
    '4-3-3-aanvallend': '4-3-3 Aanvallend',
    '4-3-3-verdedigend': '4-3-3 Verdedigend',
    '4-4-2-plat': '4-4-2 Plat',
    '4-4-2-ruit': '4-4-2 Ruit',
    '3-4-3': '3-4-3',
    '5-3-2': '5-3-2'
  };
  
  export const positionOrder = ['Keeper', 'Verdediger', 'Middenvelder', 'Aanvaller'] as const;
  
  export const positionEmojis: Record<string, string> = {
    'Keeper': '🧤',
    'Verdediger': '🛡️',
    'Middenvelder': '⚙️',
    'Aanvaller': '⚡'
  };
  
  export const DEFAULT_FORMATION = '4-3-3-aanvallend';
  
  export const normalizeFormation = (form: string | null | undefined): string => {
    if (!form || !(form in formations)) return DEFAULT_FORMATION;
    return form;
  };