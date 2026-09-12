// Plain browser client — session lives in localStorage. Every auth check
// happens client-side now (see src/app/page.js), so we don't need the
// cookie-syncing @supabase/ssr client anymore.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl ="";
const supabaseAnonKey = "";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
