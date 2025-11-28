import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ WARNING: Supabase keys are missing. Database features will not work.');
  // We do NOT exit the process here anymore.
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase };