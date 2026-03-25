import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wavbcwynziixumsnlvbm.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YjfbeG9B8qzN8SFUzOhn2Q_oUVeeO0d';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('metas_usuarios').select('*').limit(1);
  console.log(Object.keys(data?.[0] || {}));
}
check();
