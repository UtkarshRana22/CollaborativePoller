import { createClient } from '@supabase/supabase-js';

const supabaseUrl ="https://bltbrlengtnujwdmlfyc.supabase.co";
const supabaseAnonKey = "sb_publishable_ffrggBnhX3WKKua5AZ6SIQ_a38ghnE3";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
