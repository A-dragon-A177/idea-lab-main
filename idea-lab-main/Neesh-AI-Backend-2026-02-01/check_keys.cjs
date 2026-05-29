const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://svtpjdaxikucgpflbeln.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2dHBqZGF4aWt1Y2dwZmxiZWxuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ5NDgxNCwiZXhwIjoyMDg0MDcwODE0fQ.DsH1iiDhg7Jo2Md1MZswdKnN2EA_NpoKCLAhF4KOEQo';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: project, error: pErr } = await supabase.from('projects').select('owner_id').eq('id', '290eba73-cf08-4f4f-9370-1cb2d2f5b891').single();
    if (pErr) {
        console.error('Project error:', pErr);
        return;
    }
    console.log('Project owner:', project.owner_id);

    const { data: keys, error: kErr } = await supabase.from('user_api_keys').select('*').eq('user_id', project.owner_id);
    if (kErr) {
        console.error('Keys error:', kErr);
        return;
    }
    console.log('User API Keys:', JSON.stringify(keys, null, 2));
}

check();
