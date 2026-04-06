import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_CLOUD_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_CLOUD_KEY || '';

export const supabaseCloud = supabaseUrl
  ? createClient(supabaseUrl, supabaseKey)
  : null;
