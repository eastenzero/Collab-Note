import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigError = !supabaseUrl || !supabaseKey
  ? 'Supabase URL or Key is missing in environment variables'
  : null;

export const supabase = supabaseConfigError ? null : createClient(supabaseUrl!, supabaseKey!);
