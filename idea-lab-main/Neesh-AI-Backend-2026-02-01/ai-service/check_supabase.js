const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkProjects() {
    console.log("Checking Supabase connection...");
    const { data, error } = await supabase.from('projects').select('id, name').limit(10);
    
    if (error) {
        console.error("Supabase Error:", error.message);
        return;
    }
    
    if (!data || data.length === 0) {
        console.log("No projects found in the database.");
    } else {
        console.log(`Found ${data.length} projects:`);
        data.forEach(p => console.log(`- ${p.name} (${p.id})`));
    }

    const testId = 'b965337d-1080-4e4c-8932-e329956b7ea0';
    const { data: specific, error: sErr } = await supabase.from('projects').select('id, name').eq('id', testId).single();
    if (sErr) console.log(`Project ${testId} not found individually: ${sErr.message}`);
    else console.log(`Project ${testId} found as: ${specific.name}`);
}

checkProjects();
