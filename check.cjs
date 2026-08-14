const fs = require('fs');
const env = fs.readFileSync('.env', 'utf-8');
const envUrl = env.match(/VITE_SUPABASE_URL=\"?(.*?)\"?$/m)[1].trim();
const envKey = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=\"?(.*?)\"?$/m)[1].trim();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(envUrl, envKey);

async function run() {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(10);
  console.log(JSON.stringify(data, null, 2));
}
run();
