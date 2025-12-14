import { createClient } from '@supabase/supabase-js';

// Tenta pegar as variáveis de ambiente.
// Se não existirem (modo offline/demo), usamos valores "placeholder" para que o createClient não quebre a aplicação.
const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;

const SUPABASE_URL = envUrl || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = envKey || 'placeholder';

// Essa flag controla se o app deve tentar conectar no Supabase ou usar apenas modo local
export const isSupabaseConfigured = !!envUrl && !!envKey;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const INTERNAL_DOMAIN = '@centronorte.app';