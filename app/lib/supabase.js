import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hyjewtsmytpfojdvdsta.supabase.co'
const supabaseAnonKey = 'sb_publishable_7RPcZtEDjt9YVrP_Ohn1lA_B2FjFKzQ'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
