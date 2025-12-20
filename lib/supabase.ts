
import { createClient } from '@supabase/supabase-js';

// Credenciais fornecidas pelo usuário
const SUPABASE_URL = 'https://wavbcwynziixumsnlvbm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YjfbeG9B8qzN8SFUzOhn2Q_oUVeeO0d';

export const isSupabaseConfigured = true;

// Cliente Supabase conectado à base real
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const INTERNAL_DOMAIN = '@centronorte.com.br';
