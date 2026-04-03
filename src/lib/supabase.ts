import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const placeholderUrl = 'https://placeholder.supabase.co';
const placeholderKey = 'placeholder_key';

export const supabase = createClient(
  supabaseUrl || placeholderUrl, 
  supabaseAnonKey || placeholderKey
);

export const isSupabaseConfigured = !!supabaseUrl && !!supabaseAnonKey;
